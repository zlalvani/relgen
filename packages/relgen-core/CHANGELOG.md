# @relgen/core

## 0.0.25

### Patch Changes

- c4106a8: added excludedFilePatterns config option for pr review and describe

## 0.0.24

### Patch Changes

- 38d74ff: fixed blacklisted files not being excluded in pr review

## 0.0.23

### Patch Changes

- 11d6e93: fixed 404 when retrieving pr context for prs across repos

## 0.0.22

### Patch Changes

- 1207710: add support for o3-mini

## 0.0.21

### Patch Changes

- ff0aa0f: support full file context in pr reviews
- ff0aa0f: add a file mode option to pr review to choose whether to combine or separate them into multiple prompts

## 0.0.20

### Patch Changes

- 66e6fd3: add option for evaluating rules separately during pr review

## 0.0.19

### Patch Changes

- 664d374: fixed error when attempting to build context from deleted files in a pull request

## 0.0.18

### Patch Changes

- d306f46: added support for deepseek

## 0.0.17

### Patch Changes

- 2c6b005: improved pr review prompt

## 0.0.16

### Patch Changes

- d3bc55b: added review command and api

## 0.0.15

### Patch Changes

- 1ef6b55: fix improperly trimmed templates and prompts

## 0.0.14

### Patch Changes

- abab38c: remove unused include labels option in release describe

## 0.0.13

### Patch Changes

- 87ff778: fixed broken file exclusions (currently only hardcoded lock files)
- 13b86cf: fixed binary files being incorrectly fed as context when describing PRs

## 0.0.12

### Patch Changes

- 52876de: pr describe now uses a default template

## 0.0.11

### Patch Changes

- a2e2117: fixed ambiguous template prompt

## 0.0.10

### Patch Changes

- 431f1e1: added the entirety of changed files in a PR to the context in pr describe
- 444c5b7: moved templates to the system prompt

## 0.0.9

### Patch Changes

- 3aea91d: properly handle newlines in github comments when deserializing metadata

## 0.0.8

### Patch Changes

- 249f5a7: added pr ascribe command; added --unreleased argument to release ascribe and release describe
- 6c96986: moved pr ascribe to remote ascribe

## 0.0.7

### Patch Changes

- d305921: new release ascribe command and corresponding core function

## 0.0.6

### Patch Changes

- 4963360: added title and complexity to remote pr describe, and embedded metadata in PR comments

## 0.0.5

### Patch Changes

- 30d27ac: fix: handle 403 unauthorized from github when getting the current user

## 0.0.4

### Patch Changes

- 8d281ca: add a footer parameter to remote pr describe to identify relgen output

## 0.0.3

### Patch Changes

- dca4eae: fixed examples in readme

## 0.0.2

### Patch Changes

- eaaa95d: switch core to export built files
