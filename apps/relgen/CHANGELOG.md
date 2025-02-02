# relgen

## 0.0.27

### Patch Changes

- 1207710: add support for o3-mini
- Updated dependencies [1207710]
  - @relgen/core@0.0.22

## 0.0.26

### Patch Changes

- 66865a6: support fetching github token from gh cli

## 0.0.25

### Patch Changes

- ff0aa0f: support full file context in pr reviews
- ff0aa0f: add a file mode option to pr review to choose whether to combine or separate them into multiple prompts
- Updated dependencies [ff0aa0f]
- Updated dependencies [ff0aa0f]
  - @relgen/core@0.0.21

## 0.0.24

### Patch Changes

- 66e6fd3: add option for evaluating rules separately during pr review
- 66e6fd3: fix config files incorrectly rejecting deepseek
- Updated dependencies [66e6fd3]
  - @relgen/core@0.0.20

## 0.0.23

### Patch Changes

- Updated dependencies [664d374]
  - @relgen/core@0.0.19

## 0.0.22

### Patch Changes

- da8183e: added --rule-file option to remote pr review
- d306f46: added support for deepseek
- Updated dependencies [d306f46]
  - @relgen/core@0.0.18

## 0.0.21

### Patch Changes

- 2c6b005: added support for rules in files for remote pr review
- Updated dependencies [2c6b005]
  - @relgen/core@0.0.17

## 0.0.20

### Patch Changes

- d3bc55b: added review command and api
- Updated dependencies [d3bc55b]
  - @relgen/core@0.0.16

## 0.0.19

### Patch Changes

- 1ef6b55: fix improperly trimmed templates and prompts
- Updated dependencies [1ef6b55]
  - @relgen/core@0.0.15

## 0.0.18

### Patch Changes

- abab38c: remove unused include labels option in release describe
- Updated dependencies [abab38c]
  - @relgen/core@0.0.14

## 0.0.17

### Patch Changes

- Updated dependencies [87ff778]
- Updated dependencies [13b86cf]
  - @relgen/core@0.0.13

## 0.0.16

### Patch Changes

- Updated dependencies [52876de]
  - @relgen/core@0.0.12

## 0.0.15

### Patch Changes

- c114d22: support excluded-contexts for remote pr describe, remote release ascribe, remote ascribe
- Updated dependencies [a2e2117]
  - @relgen/core@0.0.11

## 0.0.14

### Patch Changes

- Updated dependencies [431f1e1]
- Updated dependencies [444c5b7]
  - @relgen/core@0.0.10

## 0.0.13

### Patch Changes

- 26b8063: added `--json` option to output as json
- Updated dependencies [3aea91d]
  - @relgen/core@0.0.9

## 0.0.12

### Patch Changes

- 249f5a7: added pr ascribe command; added --unreleased argument to release ascribe and release describe
- 6c96986: moved pr ascribe to remote ascribe
- Updated dependencies [249f5a7]
- Updated dependencies [6c96986]
  - @relgen/core@0.0.8

## 0.0.11

### Patch Changes

- d305921: new release ascribe command and corresponding core function
- Updated dependencies [d305921]
  - @relgen/core@0.0.7

## 0.0.10

### Patch Changes

- 4963360: added title and complexity to remote pr describe, and embedded metadata in PR comments
- 98b904a: removed broken release describe --from default argument
- Updated dependencies [4963360]
  - @relgen/core@0.0.6

## 0.0.9

### Patch Changes

- a967267: added support for mult arg specifying owner/repo/num

## 0.0.8

### Patch Changes

- Updated dependencies [30d27ac]
  - @relgen/core@0.0.5

## 0.0.7

### Patch Changes

- 8d281ca: add a footer parameter to remote pr describe to identify relgen output
- Updated dependencies [8d281ca]
  - @relgen/core@0.0.4

## 0.0.6

### Patch Changes

- 4d115cd: enable node 18 support

## 0.0.5

### Patch Changes

- 6837a91: renamed GH_TOKEN to GITHUB_TOKEN env var

## 0.0.4

### Patch Changes

- dca4eae: fixed examples in readme
- Updated dependencies [dca4eae]
  - @relgen/core@0.0.3

## 0.0.3

### Patch Changes

- eaaa95d: switch core to export built files
- Updated dependencies [eaaa95d]
  - @relgen/core@0.0.2
