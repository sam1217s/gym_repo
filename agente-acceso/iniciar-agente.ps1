# Arranca el agente de la puerta y lo mantiene vivo: si el proceso termina (un
# error, el lector desconectado, una actualizacion), lo vuelve a levantar a los
# 5 segundos. Lo lanza la tarea de Windows que crea el instalador (o
# `instalar-inicio.ps1` en desarrollo).
#
# - Usa el Node que trae el instalador (carpeta `node\`) y, si no esta, el del PATH.
# - El `.env` es solo de desarrollo: el agente instalado no lo lleva.
# - La salida queda en la carpeta de datos (ProgramData\GymBarichara\Puerta\agente.log).
#   Si crece de 5 MB, se guarda como agente.anterior.log y se empieza uno nuevo.

$ErrorActionPreference = 'Continue'
# Node escribe UTF-8; sin esto PowerShell lo leeria con la pagina de codigos OEM.
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Set-Location -Path $PSScriptRoot

$datos = if ($env:CARPETA_DATOS) { $env:CARPETA_DATOS } else { Join-Path $env:ProgramData 'GymBarichara\Puerta' }
New-Item -ItemType Directory -Force -Path $datos | Out-Null
$registro = Join-Path $datos 'agente.log'
$limiteBytes = 5MB

$node = Join-Path $PSScriptRoot 'node\node.exe'
if (-not (Test-Path $node)) { $node = 'node' }

$argumentos = @()
if (Test-Path (Join-Path $PSScriptRoot '.env')) { $argumentos += '--env-file=.env' }
$argumentos += 'src/index.js'

while ($true) {
  if ((Test-Path $registro) -and ((Get-Item $registro).Length -gt $limiteBytes)) {
    Move-Item -Force $registro (Join-Path $datos 'agente.anterior.log')
  }

  Add-Content -Encoding utf8 -Path $registro -Value "`n=== $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') arranca el agente ==="
  # Out-File en UTF-8: `*>>` de PowerShell 5 escribe UTF-16 y el registro quedaria ilegible.
  & $node @argumentos 2>&1 | ForEach-Object { "$_" } | Out-File -FilePath $registro -Append -Encoding utf8
  Add-Content -Encoding utf8 -Path $registro -Value "=== $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') el agente termino (codigo $LASTEXITCODE); reinicio en 5 s ==="

  Start-Sleep -Seconds 5
}
