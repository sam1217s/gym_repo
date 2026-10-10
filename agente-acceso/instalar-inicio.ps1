# Deja el agente de la puerta arrancando SOLO cada vez que se inicia sesion en
# este PC (oculto, sin ventana), y lo arranca ya mismo. Se ejecuta UNA vez:
#
#   powershell -ExecutionPolicy Bypass -File .\instalar-inicio.ps1
#
# Es el camino de DESARROLLO (usa el Node del PATH y el .env de esta carpeta). Para
# un PC de puerta real se usa el instalador (`instalador/construir.ps1`), que trae
# todo y no pide comandos.

$nombre = 'GymBarichara - Agente de la puerta'
$script = Join-Path $PSScriptRoot 'iniciar-agente.ps1'

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Error 'Node no esta instalado o no esta en el PATH.'
  exit 1
}

$accion = New-ScheduledTaskAction -Execute 'powershell.exe' `
  -Argument "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$script`"" `
  -WorkingDirectory $PSScriptRoot
$disparador = New-ScheduledTaskTrigger -AtLogOn -User "$env:USERDOMAIN\$env:USERNAME"
$ajustes = New-ScheduledTaskSettingsSet `
  -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
  -ExecutionTimeLimit ([TimeSpan]::Zero) `
  -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) `
  -MultipleInstances IgnoreNew

Register-ScheduledTask -TaskName $nombre -Action $accion -Trigger $disparador -Settings $ajustes `
  -Description 'Lector de huella ZK9500 + control de acceso de GymBarichara' -Force | Out-Null

Start-ScheduledTask -TaskName $nombre
Write-Host "Listo: '$nombre' arranca solo al iniciar sesion, y ya esta corriendo."
Write-Host "Registro: $(Join-Path $env:ProgramData 'GymBarichara\Puerta\agente.log')"
