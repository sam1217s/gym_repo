# Quita el arranque automatico del agente y lo detiene.
#
#   powershell -ExecutionPolicy Bypass -File .\desinstalar-inicio.ps1

$nombre = 'GymBarichara - Agente de la puerta'

Stop-ScheduledTask -TaskName $nombre -ErrorAction SilentlyContinue
Unregister-ScheduledTask -TaskName $nombre -Confirm:$false -ErrorAction SilentlyContinue

# El agente corre como un `node` hijo del script: se detiene tambien.
Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
  Where-Object { $_.CommandLine -like '*src/index.js*' -and $_.CommandLine -like '*--env-file*' } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force }

Write-Host "Listo: '$nombre' ya no arranca solo."
