# @relgen/core

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
