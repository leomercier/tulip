#!/usr/bin/env bash
# Uploads apps/web/.env to Google Cloud Secret Manager as a single secret
# and grants the Cloud Build service account access to it.
#
# Usage: ./scripts/upload-env-secrets.sh [project-id]
#
# Requires: gcloud CLI authenticated with sufficient permissions
#   - secretmanager.secrets.create / update
#   - secretmanager.secrets.setIamPolicy
#   - resourcemanager.projects.get (to look up project number)

set -euo pipefail

PROJECT_ID="${1:-tulip-c4a3c}"
SECRET_NAME="tulip-web-env"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
ENV_PATH="$REPO_ROOT/apps/web/.env"

if [ ! -f "$ENV_PATH" ]; then
  echo "Error: $ENV_PATH not found" >&2
  exit 1
fi

echo "→ Project:  $PROJECT_ID"
echo "→ Secret:   $SECRET_NAME"
echo "→ Env file: $ENV_PATH"
echo ""

# Create or add a new version
if gcloud secrets describe "$SECRET_NAME" --project="$PROJECT_ID" &>/dev/null; then
  gcloud secrets versions add "$SECRET_NAME" \
    --project="$PROJECT_ID" \
    --data-file="$ENV_PATH"
  echo "✓ Added new version to existing secret '$SECRET_NAME'"
else
  gcloud secrets create "$SECRET_NAME" \
    --project="$PROJECT_ID" \
    --data-file="$ENV_PATH" \
    --replication-policy="automatic"
  echo "✓ Created secret '$SECRET_NAME'"
fi

# Grant Cloud Build service account access
PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format="value(projectNumber)")
CB_SA="${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com"

echo ""
echo "→ Granting secretAccessor to Cloud Build SA: $CB_SA"
gcloud secrets add-iam-policy-binding "$SECRET_NAME" \
  --project="$PROJECT_ID" \
  --member="serviceAccount:$CB_SA" \
  --role="roles/secretmanager.secretAccessor"

echo ""
echo "✓ Done. Cloud Build can now read '$SECRET_NAME' from Secret Manager."
echo ""
echo "  Make sure cloudbuild.yaml references:"
echo "  projects/$PROJECT_ID/secrets/$SECRET_NAME/versions/latest"
