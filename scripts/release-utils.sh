#!/bin/bash

set -euo pipefail

# Color definitions
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if working directory is clean
check_clean_working_dir() {
    if [ -n "$(git status --porcelain)" ]; then
        log_error "Working directory is not clean. Please commit or stash your changes."
        exit 1
    fi
    log_success "Working directory is clean"
}

# Check if we're on main branch
check_main_branch() {
    if [ "$(git rev-parse --abbrev-ref HEAD)" != "main" ]; then
        log_error "Not on main branch. Please switch to main branch first."
        exit 1
    fi
    log_success "On main branch"
}

# Get current version from manifest.json
get_current_version() {
    if [ ! -f manifest.json ]; then
        log_error "manifest.json not found"
        exit 1
    fi
    CURRENT_VERSION=$(jq -r '.version' manifest.json)
    log_info "Current version: $CURRENT_VERSION"
}

# Parse a semantic version string (allowing prerelease/build metadata)
parse_semver() {
    local version=$1
    local semver_regex='^([0-9]+)\.([0-9]+)\.([0-9]+)(-[0-9A-Za-z.-]+)?(\+[0-9A-Za-z.-]+)?$'

    if [[ $version =~ $semver_regex ]]; then
        SEMVER_MAJOR="${BASH_REMATCH[1]}"
        SEMVER_MINOR="${BASH_REMATCH[2]}"
        SEMVER_PATCH="${BASH_REMATCH[3]}"
        SEMVER_PRERELEASE="${BASH_REMATCH[4]}"
        SEMVER_BUILD="${BASH_REMATCH[5]}"
    else
        log_error "Version '$version' is not a valid semver string"
        exit 1
    fi
}

# Bump version in manifest.json and package.json
bump_version() {
    local bump_type=$1
    local current_version=$CURRENT_VERSION
    local major minor patch prerelease build

    SEMVER_PRERELEASE=""
    SEMVER_BUILD=""
    parse_semver "$current_version"

    major=$SEMVER_MAJOR
    minor=$SEMVER_MINOR
    patch=$SEMVER_PATCH
    prerelease=${SEMVER_PRERELEASE:-}
    build=${SEMVER_BUILD:-}

    case $bump_type in
        major)
            major=$((major + 1))
            minor=0
            patch=0
            ;;
        minor)
            minor=$((minor + 1))
            patch=0
            ;;
        patch)
            patch=$((patch + 1))
            ;;
        *)
            log_error "Invalid bump type. Use major, minor, or patch."
            exit 1
            ;;
    esac

    NEW_VERSION="$major.$minor.$patch$prerelease$build"
    log_info "Bumping version to $NEW_VERSION"

    # Update manifest.json
    jq --arg v "$NEW_VERSION" '.version = $v' manifest.json > manifest.json.tmp
    mv manifest.json.tmp manifest.json

    # Update package.json if it exists
    if [ -f package.json ]; then
        jq --arg v "$NEW_VERSION" '.version = $v' package.json > package.json.tmp
        mv package.json.tmp package.json
    fi

    log_success "Version bumped to $NEW_VERSION"
}

# Generate changelog from git commits
generate_changelog() {
    local last_tag=$(git describe --tags --abbrev=0 2>/dev/null || echo "v0.0.0")
    local commits=$(git log --pretty=format:"- %s" $last_tag..HEAD)

    if [ -z "$commits" ]; then
        log_warning "No new commits since last tag"
    else
        echo "# Changelog" > CHANGELOG.md
        echo "" >> CHANGELOG.md
        echo "## $NEW_VERSION" >> CHANGELOG.md
        echo "" >> CHANGELOG.md
        echo "$commits" >> CHANGELOG.md
        log_success "Changelog generated"
    fi
}

# Run tests
run_tests() {
    log_info "Running lint checks (yarn lint)"
    if ! yarn lint; then
        log_error "Linting failed"
        return 1
    fi

    log_info "Running unit tests (yarn test)"
    if ! yarn test; then
        log_error "Unit tests failed"
        return 1
    fi

    log_info "Building production bundle (yarn build)"
    if ! yarn build; then
        log_error "Build failed"
        return 1
    fi

    log_info "Regenerating API docs (yarn docs)"
    if ! yarn docs; then
        log_error "API docs generation failed"
        return 1
    fi

    log_success "Lint, test, build, and docs steps completed"
}

package_release_artifact() {
    local version=$1
    if [ -z "$version" ]; then
        log_error "package_release_artifact requires the release version"
        exit 1
    fi

    local release_dir="release"
    local archive_path="$release_dir/obsidian-rag-$version.zip"

    mkdir -p "$release_dir"

    for asset in main.js manifest.json styles.css; do
        if [ ! -f "$asset" ]; then
            log_error "Required asset '$asset' missing. Run yarn build first."
            exit 1
        fi
    done

    log_info "Packaging runtime assets into $archive_path"
    rm -f "$archive_path"
    if ! zip -j "$archive_path" main.js manifest.json styles.css >/dev/null; then
        log_error "Failed to create archive $archive_path"
        exit 1
    fi

    if git rev-parse --git-dir >/dev/null 2>&1; then
        git add -N -f "$archive_path" >/dev/null 2>&1 || true
    fi

    log_success "Created release archive at $archive_path"
}

# Create git tag and push changes
create_tag() {
    git add manifest.json package.json CHANGELOG.md
    git commit -m "Release v$NEW_VERSION"
    git tag -a "v$NEW_VERSION" -m "Release v$NEW_VERSION"
    git push origin main
    git push origin "v$NEW_VERSION"
    log_success "Tag v$NEW_VERSION created and pushed"
}

# Export all functions
export -f log_info log_success log_warning log_error
export -f check_clean_working_dir check_main_branch get_current_version
export -f bump_version generate_changelog run_tests package_release_artifact create_tag