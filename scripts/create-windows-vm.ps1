param(
    [ValidatePattern('^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$')][string]$Name = 'Greiva-IME-Win11',
    [ValidateRange(4096, 8192)][int]$MemoryMB = 4096,
    [ValidateRange(2, 8)][int]$CPUs = 4
)
$ErrorActionPreference = 'Stop'
$vmProject = Split-Path -Parent $PSScriptRoot
$vmArea = Join-Path $vmProject '.data\windows-vm'
$vmManager = 'C:\Program Files\Oracle\VirtualBox\VBoxManage.exe'
if (!(Test-Path -LiteralPath $vmManager)) { throw 'VirtualBox is not installed.' }
New-Item -ItemType Directory -Force -Path (Join-Path $vmArea 'registry') | Out-Null
# Keep this project's VM registry separate from other VirtualBox installations.
$env:VBOX_USER_HOME = Join-Path $vmArea 'registry'
function Invoke-GreivaVBox {
    & $vmManager @args
    if ($LASTEXITCODE -ne 0) { throw "VBoxManage failed: $($args[0])" }
}
$vmExisting = & $vmManager list vms
if ($LASTEXITCODE -ne 0) { throw 'Cannot read the project VM registry.' }
if ($vmExisting -match ('^"' + [regex]::Escape($Name) + '" ')) {
    throw 'The VM already exists; refusing to overwrite its configuration or disk.'
}
Invoke-GreivaVBox createvm --name $Name --ostype Windows11_64 --basefolder (Join-Path $vmArea 'machines') --register
Invoke-GreivaVBox modifyvm $Name --memory $MemoryMB --cpus $CPUs --firmware efi --tpm-type 2.0 --ioapic on --graphicscontroller vboxsvga --vram 128 --nic1 nat --clipboard-mode disabled --drag-and-drop disabled --audio-enabled off --usb-ohci off --usb-ehci off --usb-xhci off
$vmDisk = Join-Path $vmArea "machines\$Name\$Name.vdi"
Invoke-GreivaVBox createmedium disk --filename $vmDisk --size 98304 --format VDI --variant Standard
Invoke-GreivaVBox storagectl $Name --name SATA --add sata --controller IntelAhci --portcount 4
Invoke-GreivaVBox storageattach $Name --storagectl SATA --port 0 --device 0 --type hdd --medium $vmDisk
Invoke-GreivaVBox storageattach $Name --storagectl SATA --port 1 --device 0 --type dvddrive --medium emptydrive
Invoke-GreivaVBox showvminfo $Name --machinereadable
Write-Output 'VM created without starting it. Verify the ISO checksum before attaching installation media.'
