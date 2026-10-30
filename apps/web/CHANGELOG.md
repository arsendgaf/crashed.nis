# Changelog

## [3.2.1](https://github.com/arsendgaf/crashed.nis/compare/web-v3.2.0...web-v3.2.1) (2026-10-30)


### Bug Fixes

* purge SWR bookkeeping on login so re-login without a reload re-fetches ([2824330](https://github.com/arsendgaf/crashed.nis/commit/2824330f144798cd58b3040130e8e628af9b3a7d))

## [3.2.0](https://github.com/arsendgaf/crashed.nis/compare/web-v3.1.0...web-v3.2.0) (2026-10-29)


### Features

* remember the last prediction, purge local data on logout, square the mobile panel top ([36ee44d](https://github.com/arsendgaf/crashed.nis/commit/36ee44dc8beea27be919b3718cacb15e3e4a36d7))


### Bug Fixes

* clear the remaining lint warning and Vite chunk-size warning ([9b2dd50](https://github.com/arsendgaf/crashed.nis/commit/9b2dd50b633d4e3b8aab33da5a14e4d82bf058ff))
* drop the fragile bare-cn re-export shim and pin CI's bun ([b554649](https://github.com/arsendgaf/crashed.nis/commit/b554649fdf8f004fbc42f9d28a775c02e0ea2bd8))
* pad the logout drawer horizontally and stack its actions full-width ([24b7102](https://github.com/arsendgaf/crashed.nis/commit/24b71024c61ef08cc272c2850ec17678c36a110d))
* remember the prediction on selection, keep it memory-only ([6524062](https://github.com/arsendgaf/crashed.nis/commit/65240622994541cab06991a68270c8f21eb41084))
* stretch the logout and predict actions to full dialog width ([67ae9e4](https://github.com/arsendgaf/crashed.nis/commit/67ae9e4752d0c3ea0c924033f3982a0e52ce3f04))

## [3.1.0](https://github.com/arsendgaf/crashed.nis/compare/web-v3.0.0...web-v3.1.0) (2026-10-29)


### Features

* dim the iOS theme color while a modal is open ([a626148](https://github.com/arsendgaf/crashed.nis/commit/a6261488dfafa260642a01c04af9b57c0c603ff1))
* tint the browser chrome to the page background while a modal is open ([a5ecaff](https://github.com/arsendgaf/crashed.nis/commit/a5ecaffd69298d55004eda67686d6caa271fbe0f))


### Bug Fixes

* drive Safari 26 tinting from the body background-color ([78ee7d0](https://github.com/arsendgaf/crashed.nis/commit/78ee7d0661d7f00af2b55cebc00b84adc2b8f5b4))
* match the modal-open tint to the sheet surface color ([a0106d5](https://github.com/arsendgaf/crashed.nis/commit/a0106d5ec68f6089f676550065ff2b4963cee4cc))
* stop the horizontally overflowing mobile identity strip ([9082e1d](https://github.com/arsendgaf/crashed.nis/commit/9082e1dee400486853ac76eb95b4b527a9987ece))
* un-freeze modals by bounding the theme-color observer ([fec1291](https://github.com/arsendgaf/crashed.nis/commit/fec1291b2bd047464c152a546703645ac77e3b4e))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @crashednis/ui bumped to 3.1.0

## [3.0.0](https://github.com/arsendgaf/crashed.nis/compare/web-v2.0.0...web-v3.0.0) (2026-10-28)


### ⚠ BREAKING CHANGES

* National Student Information System relaunch on Bun + Hono + Vite

### Features

* National Student Information System relaunch on Bun + Hono + Vite ([856d107](https://github.com/arsendgaf/crashed.nis/commit/856d10739b2cd4eb69da19c0d9ef0b6c5afa0f17))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @crashednis/ui bumped to 3.0.0
