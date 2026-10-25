# dsh-hindsight-manager: hide the uv.exe console window the daemon spawns.
#
# Windows 11 uses Windows Terminal as the default console host, which shows a
# window even for a spawn that asked for windowsHide. This helper finds windows
# whose title contains "uv.exe" and hides them. It is cosmetic: the process keeps
# running, only its window disappears. Never close that window by hand — that
# kills the daemon.
#
# Spawned detached by the Host half right after a daemon start; deliberately not
# awaited. It waits 10 s for the window to appear, then re-hides every 5 s for
# two minutes, which covers the cold-start window.
Start-Sleep -Seconds 10

Add-Type -TypeDefinition @"
using System;
using System.Text;
using System.Runtime.InteropServices;
using System.Collections.Generic;
public class DshHindsightWindow {
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc cb, IntPtr l);
  public delegate bool EnumProc(IntPtr h, IntPtr l);
  [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int c);
  public static List<IntPtr> Find(string sub) {
    var list = new List<IntPtr>();
    EnumWindows((h, l) => {
      var sb = new StringBuilder(512);
      GetWindowText(h, sb, 512);
      if (sb.ToString().Contains(sub)) list.Add(h);
      return true;
    }, IntPtr.Zero);
    return list;
  }
}
"@

for ($i = 0; $i -lt 24; $i++) {
  [DshHindsightWindow]::Find('uv.exe') | ForEach-Object { [DshHindsightWindow]::ShowWindow($_, 0) | Out-Null }
  Start-Sleep -Seconds 5
}
