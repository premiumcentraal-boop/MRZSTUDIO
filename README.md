# MRZ Studio Local

Windows employee badge studio with reliable launch, Photoshop jobs and Cyclone
Glass connections and the native **ID Generator** Cyclone Ports plugin. Current local version: **7.2.0**, based on MRZ Studio V7.

Download the local package from [Releases](https://github.com/premiumcentraal-boop/MRZSTUDIO/releases),
extract it into a dedicated folder, then double-click **Start-MRZ-Local.cmd**.
Future updates: **Update-MRZ-Local.cmd** or `mrz update`.

For source checkout, run `mrz build` once, then `mrz start`.
Requires Windows and Node.js 22 or newer; Photoshop and your own PSD templates
are required for real badge generation.

See [setup, commands and updates](README-LOCAL.md),
[MCP connections](app/docs/MCP_CONNECTIONS.md), and
[runtime and release verification](app/docs/LOCAL_RUNTIME.md).

ID Generator: open `/settings/id-generator` for saved defaults and Ports pairing,
or `/plugins/id-generator` for the generator panel. The signed plugin is included
in normal startup on port 8787. See the [Ports builder handoff](app/docs/ID_GENERATOR_PORTS_HANDOFF.md)
and [connector contract/setup](app/local-server/id-generator/README.md).

The existing Vite app now lives in `app/`. Root `scripts/` manages local launch,
health checks, verified updates and rollback. Release packages include the
prebuilt website. Personal data and Photoshop templates are excluded.
