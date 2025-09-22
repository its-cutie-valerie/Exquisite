GS MTC Helper (Windows only)

This tiny helper is intended to bridge Electron to Windows Global System Media Transport Controls (GSMTC).

Goals
- Send play/pause/next/previous/stop commands to the active system session
- Optionally subscribe to session changes (future)

Build prerequisites
- Windows 10/11 with .NET 6+ SDK

Build
- dotnet build

Run
- dotnet run -- [play|pause|next|previous|stop]
