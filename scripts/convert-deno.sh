#!/bin/bash
DENO_DIR=dist/deno/


mkdir -p ${DENO_DIR}
cp -r dist/js/* ${DENO_DIR}
find ${DENO_DIR} -type f -exec sed -i "s|import f from \"cross-fetch\"|const f=fetch|g" {} \;

