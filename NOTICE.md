# Third-party notices

## Amixi — included with permission

`third_party/amixi/` contains the Amixi behaviour and resource packs. They are included
here **with the Amixi author's permission**, confirmed directly with the project owner.
Credit the Amixi team if you redistribute a world or a build that contains them.

The build patches this copy at package time (`tools/codemod/`) and writes the result to
`dist/AmixiXPvP.mcaddon`. The committed copy is never modified in place — the patch runs on
a temporary copy, so `git status` stays clean after a build.

## PvP Practice Bots — not included

**PvP Practice Bots** by Kaden Collier / Petstorebuffet is a third-party addon whose licence
permits personal and server use and modification, and prohibits redistribution of the
original or of modified versions. It is **not** included, forked or repackaged here.

The bridge drives it through its own data contract — a simulated player with its own name
prefix and `PvPbot` tag, plus a `bot_data` dynamic property in the shape its manager reads.
That is the same interface the addon uses internally, so no code is copied and nothing is
patched. Install it yourself from its official page.

## Code in this repository

Apache-2.0, matching the LICENSE file.
