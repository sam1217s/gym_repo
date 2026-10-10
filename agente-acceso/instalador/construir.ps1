# Arma el instalador del PC de la puerta: salida\InstalarPuertaGymBarichara.exe
#
#   powershell -ExecutionPolicy Bypass -File .\construir.ps1
#
# Opciones:
#   -Sdk   ruta al setup.exe del ZKFinger Standard SDK 5.3 (driver del lector).
#   -Web   otro servidor, SOLO para probar (ej. http://localhost:9000). Genera
#          InstalarPuertaGymBarichara-prueba.exe, que deja el agente apuntando ahi.
#
# Requiere Inno Setup 6 (winget install JRSoftware.InnoSetup) y Node x64 en el PATH:
# su node.exe es el que se empaqueta, asi que el PC de la puerta no necesita Node.

param(
  [string] $Sdk = 'D:\Descargass\9774a946c3f659ddf2ae90bc8dadc3eb\ZKFingerSDK_Windows_Standard\ZKFinger Standard SDK 5.3.0.33\setup.exe',
  [string] $Web = 'https://gymbarichara.com'
)

$ErrorActionPreference = 'Stop'
$aqui = $PSScriptRoot
$agente = Split-Path $aqui -Parent
$salida = Join-Path $aqui 'salida'
$paquete = Join-Path $salida 'paquete'

$iscc = @(
  (Join-Path $env:LOCALAPPDATA 'Programs\Inno Setup 6\ISCC.exe'),
  (Join-Path ${env:ProgramFiles(x86)} 'Inno Setup 6\ISCC.exe'),
  (Join-Path $env:ProgramFiles 'Inno Setup 6\ISCC.exe')
) | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $iscc) { throw 'Falta Inno Setup 6: winget install JRSoftware.InnoSetup' }
if (-not (Test-Path $Sdk)) { throw "No encuentro el setup del ZKFinger SDK en: $Sdk (pasalo con -Sdk)" }

$node = (Get-Command node).Source
if ((& $node -p 'process.arch') -ne 'x64') { throw 'El node.exe del PATH no es x64' }

# --- Paquete: solo lo que necesita el agente en produccion --------------------
if (Test-Path $paquete) { Remove-Item -Recurse -Force $paquete }
New-Item -ItemType Directory -Force -Path (Join-Path $paquete 'node') | Out-Null

Copy-Item -Recurse (Join-Path $agente 'src') $paquete
Copy-Item (Join-Path $agente 'package.json'), (Join-Path $agente 'iniciar-agente.ps1') $paquete
Copy-Item $node (Join-Path $paquete 'node\node.exe')

Push-Location $agente
try {
  # Dependencias de produccion, sin tocar las del repo.
  Copy-Item (Join-Path $agente 'package-lock.json') $paquete
  & npm ci --omit=dev --ignore-scripts --no-audit --no-fund --prefix $paquete | Out-Host
  if ($LASTEXITCODE -ne 0) { throw 'npm ci fallo' }
} finally {
  Pop-Location
}
# koffi trae binarios para todas las plataformas: solo hace falta Windows x64.
Get-ChildItem (Join-Path $paquete 'node_modules\koffi\build\koffi') -Directory |
  Where-Object { $_.Name -ne 'win32_x64' } |
  Remove-Item -Recurse -Force

# --- Compilar ------------------------------------------------------------------
$version = (Get-Content (Join-Path $agente 'package.json') -Raw | ConvertFrom-Json).version
$definiciones = @(
  "/DVersion=$version",
  "/DPaquete=$paquete",
  "/DSdkZk=$Sdk",
  "/DIcono=$(Resolve-Path (Join-Path $agente '..\frontend\public\favicon.ico'))",
  "/DWeb=$($Web.TrimEnd('/'))"
)

if ($Web.TrimEnd('/') -ne 'https://gymbarichara.com') {
  $configPrueba = Join-Path $salida 'config-prueba.json'
  # En pruebas locales la API va por el puerto del backend, no por el del front.
  $api = if ($Web -match 'localhost:9000') { 'http://localhost:3000/api' } else { "$($Web.TrimEnd('/'))/api" }
  @{ servidorApi = $api; origenes = $Web.TrimEnd('/') } | ConvertTo-Json | Set-Content -Encoding utf8 $configPrueba
  $definiciones += "/DConfigInicial=$configPrueba", '/DNombreSalida=InstalarPuertaGymBarichara-prueba'
} else {
  $definiciones += '/DNombreSalida=InstalarPuertaGymBarichara'
}

& $iscc /Q @definiciones (Join-Path $aqui 'puerta.iss')
if ($LASTEXITCODE -ne 0) { throw 'Inno Setup no pudo compilar el instalador' }

Remove-Item -Recurse -Force $paquete

# El de PRODUCCION se publica con la web: el panel lo ofrece en /descargas/ (Sedes ->
# Puestos de entrada). Va en frontend/public, que Quasar copia tal cual al build; no
# se versiona en git (pesa ~37 MB): por eso hay que correr esto antes de desplegar.
if ($Web.TrimEnd('/') -eq 'https://gymbarichara.com') {
  $descargas = Join-Path $agente '..\frontend\public\descargas'
  New-Item -ItemType Directory -Force -Path $descargas | Out-Null
  Copy-Item -Force (Join-Path $salida 'InstalarPuertaGymBarichara.exe') $descargas
}
Remove-Item -Force (Join-Path $salida 'config-prueba.json') -ErrorAction SilentlyContinue
Get-ChildItem $salida -Filter *.exe | ForEach-Object { '{0}  ({1:N1} MB)' -f $_.FullName, ($_.Length / 1MB) }
