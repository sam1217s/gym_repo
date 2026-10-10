# Arranque automatico del agente en el PC de la puerta. Lo usa el instalador
# (nadie lo corre a mano):
#
#   tarea.ps1 -Accion instalar -Carpeta "C:\Program Files\GymBarichara\Puerta"
#   tarea.ps1 -Accion detener  -Carpeta ...   (antes de actualizar archivos)
#   tarea.ps1 -Accion quitar   -Carpeta ...   (al desinstalar)
#
# La tarea corre como SYSTEM y AL ENCENDER el equipo: la puerta funciona aunque
# nadie inicie sesion en Windows, y sin ventanas que alguien pueda cerrar.

param(
  [Parameter(Mandatory)] [ValidateSet('instalar', 'detener', 'quitar')] [string] $Accion,
  [Parameter(Mandatory)] [string] $Carpeta
)

$nombre = 'GymBarichara - Puerta'

# Corre oculto desde el instalador: lo que pase queda en la carpeta de datos, para
# poder diagnosticar en la sede sin consola.
$datos = Join-Path $env:ProgramData 'GymBarichara\Puerta'
New-Item -ItemType Directory -Force -Path $datos | Out-Null
Start-Transcript -Path (Join-Path $datos 'instalacion.log') -Append | Out-Null
$ErrorActionPreference = 'Stop'

function Detener {
  Stop-ScheduledTask -TaskName $nombre -ErrorAction SilentlyContinue
  # El agente es un node.exe hijo del script de arranque: se cierra tambien, o
  # bloquearia los archivos que el instalador va a reemplazar.
  Get-CimInstance Win32_Process -Filter "Name='node.exe' OR Name='powershell.exe'" |
    Where-Object { $_.ExecutablePath -like "$Carpeta*" -or $_.CommandLine -like "*$Carpeta*iniciar-agente.ps1*" } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
}

switch ($Accion) {
  'instalar' {
    Detener
    $script = Join-Path $Carpeta 'iniciar-agente.ps1'
    # OJO: no llamarla $accion. PowerShell no distingue mayusculas, seria el
    # parametro -Accion (con su ValidateSet) y la asignacion lanzaria.
    $programa = New-ScheduledTaskAction -Execute 'powershell.exe' `
      -Argument "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$script`"" `
      -WorkingDirectory $Carpeta
    $disparador = New-ScheduledTaskTrigger -AtStartup
    $principal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest
    $ajustes = New-ScheduledTaskSettingsSet `
      -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
      -ExecutionTimeLimit ([TimeSpan]::Zero) `
      -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) `
      -MultipleInstances IgnoreNew
    Register-ScheduledTask -TaskName $nombre -Action $programa -Trigger $disparador -Principal $principal `
      -Settings $ajustes -Description 'Lector de huella y control de acceso de GymBarichara' -Force | Out-Null
    Start-ScheduledTask -TaskName $nombre
  }
  'detener' { Detener }
  'quitar' {
    Detener
    Unregister-ScheduledTask -TaskName $nombre -Confirm:$false -ErrorAction SilentlyContinue
  }
}

Stop-Transcript | Out-Null
