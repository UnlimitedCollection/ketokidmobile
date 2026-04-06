#!/bin/bash
set -e
cd "admin website"
pnpm install --frozen-lockfile 2>/dev/null || pnpm install
