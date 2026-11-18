# Third-party notices

This repository contains **only** the Practice Bridge and its tooling. It ships no code
from either addon it is designed to work with.

- **Amixi** (behaviour + resource pack) — third-party world template. No licence file is
  distributed with it and no permission is stated, so it is not included here. The patcher
  in `tools/codemod/` rewrites a copy you already have, on your machine, and keeps a
  `.pba-original` backup. `vendor/` is gitignored; the release build patches your copy and
  packages the result for you.
- **PvP Practice Bots** by Kaden Collier / Petstorebuffet — third-party addon whose licence
  permits personal and server use and modification, and prohibits redistribution of the
  original or of modified versions. It is **not** included, forked or repackaged here. The
  bridge drives it through its documented-in-behaviour data contract (`bot_data` plus a
  simulated player with its own name prefix), which is the same interface the addon uses
  internally.

If you publish a world that uses either addon, follow their terms: credit Petstorebuffet,
and do not redistribute Amixi.

The code in this repository is Apache-2.0, matching the LICENSE file.
