# OpenCapTable-v35 shared test vectors

`v35-test-vectors.json` pins the register's encodings: derived IDs (the cap table ID, a colon and
the SHA-256 of the encoding of namespace tag, cap table ID, security ID, `seq`, role and index),
claim hashes with their 8-bit shard prefixes, and the shared floor function `floorMulDiv(x, a, b)`.
The ledger, this SDK and apiv2 must all reproduce every vector; `test/register/ids.test.ts` and
`test/register/numeric.test.ts` recompute them against `src/register`.

## Source

The file is a verbatim copy of `test-vectors/v35.json` in
[Fairmint/open-captable-protocol-daml](https://github.com/Fairmint/open-captable-protocol-daml) at
commit `93ea933`, where `Test/daml/OpenCapTable/TestVectors.daml` asserts the same values on the
ledger. apiv2 keeps its own copy of the same file.

Edit it only by copying the source file again, and update the commit named above. A vector that
fails here means the SDK has drifted from the ledger, not that the vector is wrong.
