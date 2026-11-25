# Code signing

Release builds of `Config_Inspector.exe` are Authenticode signed with
[Azure Artifact Signing](https://learn.microsoft.com/azure/artifact-signing/) (formerly Trusted Signing)
in the `windows` job of `.github/workflows/build-release.yml`.

## How it works

- Only pushes to `main` sign. Pull requests and other branches build unsigned, exactly as before.
- GitHub signs in to Azure with OpenID Connect (`azure/login`): Azure trusts tokens that GitHub issues for
  this repository's `main` branch, so no password, client secret or certificate is stored in GitHub.
- `azure/artifact-signing-action` signs the executable (SHA-256, RFC 3161 timestamp from
  `http://timestamp.acs.microsoft.com`), `Get-AuthenticodeSignature` must report it `Valid` with a timestamp,
  and then `package_portable.py` and `checksums.py` run again so the portable ZIP, its `.sha256` and
  `SHA256SUMS` describe the signed executable. A failed signature fails the job, so nothing is published.
- The in-app updater still checks the release's SHA-256 digest, size, architecture and version; signing does
  not change that check.
- Signing is skipped while `ARTIFACT_SIGNING_PROFILE` is unset, so a repository without Azure set up still
  builds and releases unsigned.

## Repository variables

Set under **Settings > Secrets and variables > Actions > Variables**. These are identifiers, not secrets.
`azure/login` runs with `allow-no-subscriptions`, since the app only needs a token for the signing service.

| Variable | Value |
| --- | --- |
| `AZURE_CLIENT_ID` | Application (client) ID of the app registration GitHub signs in as |
| `AZURE_TENANT_ID` | Directory (tenant) ID |
| `ARTIFACT_SIGNING_ENDPOINT` | Regional endpoint of the account, such as `https://eus.codesigning.azure.net/` |
| `ARTIFACT_SIGNING_ACCOUNT` | Artifact Signing account name |
| `ARTIFACT_SIGNING_PROFILE` | Public Trust certificate profile name |

## Azure setup (once)

1. Register the `Microsoft.CodeSigning` resource provider on the subscription.
2. Create an Artifact Signing account (Basic SKU) in a supported region.
3. Complete Public Trust identity validation for the account (the owner's own ID check).
4. Create a Public Trust certificate profile linked to that validation.
5. Create an app registration (no secret) with a federated credential (scenario "GitHub Actions deploying Azure
   resources", entity Branch `main`). Its subject uses GitHub's immutable-ID format:
   `repo:TechSavage1989@44094233/Configuration-Inspector@1432648342:ref:refs/heads/main`, audience
   `api://AzureADTokenExchange`. The owner's existing `github-codesign` app registration and
   `networktoolkit-signing` account are shared with their other apps.
6. Give that app registration the **Artifact Signing Certificate Profile Signer** role on the certificate
   profile (or the account).
7. Set the repository variables above.

Certificates are short-lived and renewed by Azure automatically; the timestamp keeps old releases valid.
