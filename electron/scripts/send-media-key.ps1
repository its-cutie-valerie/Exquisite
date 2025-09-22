param(
  [Parameter(Mandatory=$true)][ValidateSet('play-pause','next','previous','stop')]
  [string]$Action
)

$VK = @{ 'play-pause' = 0xB3; 'next' = 0xB0; 'previous' = 0xB1; 'stop' = 0xB2 }

Add-Type -Namespace Native -Name KeySender -MemberDefinition @"
  using System;
  using System.Runtime.InteropServices;
  public static class KeySender {
    [DllImport("user32.dll")] public static extern void keybd_event(byte bVk, byte bScan, int dwFlags, IntPtr dwExtraInfo);
    public const int KEYEVENTF_KEYUP = 0x0002;
  }
"@

$vkCode = [byte]$VK[$Action]
[Native.KeySender]::keybd_event($vkCode, 0, 0, [IntPtr]::Zero)
Start-Sleep -Milliseconds 10
[Native.KeySender]::keybd_event($vkCode, 0, [Native.KeySender]::KEYEVENTF_KEYUP, [IntPtr]::Zero)
