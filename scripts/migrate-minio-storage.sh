#!/usr/bin/env bash
#
# MinIO Storage Migration Script
# Migrates files from old directory structure to new category-based structure:
#   {type}/{YYYY-MM}/{category1}/{category2}/{filename}
#
# Usage:
#   ./scripts/migrate-minio-storage.sh [--dry-run]
#
# Prerequisites:
#   - mc (MinIO Client) configured with alias 'local'
#   - jq installed
#   - logs/obj.json file exists
#   - bash 4.0+ (for associative arrays) or zsh
#

# Check bash version for associative array support
if [[ -n "$BASH_VERSION" ]]; then
    bash_major="${BASH_VERSION%%.*}"
    if [[ "$bash_major" -lt 4 ]]; then
        echo "Error: bash 4.0+ required (found $BASH_VERSION)"
        echo "On macOS, run with: zsh $0 $@"
        echo "Or install newer bash: brew install bash"
        exit 1
    fi
fi

set -euo pipefail

# Auto-detect MinIO client command (mc or mcli)
if command -v mc &> /dev/null; then
    MC_CMD="mc"
elif command -v mcli &> /dev/null; then
    MC_CMD="mcli"
else
    echo "Error: MinIO client (mc or mcli) not found"
    exit 1
fi

# Configuration
MINIO_ALIAS="local"
BUCKET="shadow-collector"
OBJ_LIST="logs/obj.json"
CLASSES_CSV="docs/classes.csv"
DRY_RUN=false
VERBOSE=false

# Counters
TOTAL_FILES=0
MIGRATED_FILES=0
SKIPPED_FILES=0
ERROR_FILES=0

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --verbose|-v)
            VERBOSE=true
            shift
            ;;
        --help|-h)
            echo "Usage: $0 [--dry-run] [--verbose]"
            echo "Options:"
            echo "  --dry-run    Preview changes without executing"
            echo "  --verbose    Show detailed output"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Logging functions
log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[OK]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_verbose() { [[ "$VERBOSE" == "true" ]] && echo -e "${BLUE}[DEBUG]${NC} $1" || true; }

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."

    if [[ -z "$MC_CMD" ]]; then
        log_error "MinIO client (mc/mcli) not found"
        exit 1
    fi

    if ! command -v jq &> /dev/null; then
        log_error "jq is not installed"
        exit 1
    fi

    if [[ ! -f "$OBJ_LIST" ]]; then
        log_error "Object list not found: $OBJ_LIST"
        exit 1
    fi

    if [[ ! -f "$CLASSES_CSV" ]]; then
        log_error "Classes CSV not found: $CLASSES_CSV"
        exit 1
    fi

    if ! $MC_CMD alias list "$MINIO_ALIAS" &> /dev/null; then
        log_error "MinIO alias '$MINIO_ALIAS' not configured"
        log_info "Configure: $MC_CMD alias set $MINIO_ALIAS http://127.0.0.1:9000 minioadmin minioadmin"
        exit 1
    fi

    log_success "All prerequisites met"
}

# Build label -> category lookup from CSV
declare -A LABEL_TO_CAT1
declare -A LABEL_TO_CAT2

load_category_mapping() {
    log_info "Loading category mapping from $CLASSES_CSV..."

    local count=0
    while IFS=',' read -r cat1 cat2 cat3 cat4 label rest; do
        # Skip header
        if [[ "$cat1" == "专业" ]] || [[ "$cat1" == $'\xef\xbb\xbf专业' ]]; then
            continue
        fi

        # Clean up values
        cat1=$(echo "$cat1" | sed 's/^\xef\xbb\xbf//' | xargs 2>/dev/null || echo "$cat1")
        cat2=$(echo "$cat2" | xargs 2>/dev/null || echo "$cat2")
        label=$(echo "$label" | xargs 2>/dev/null || echo "$label")

        if [[ -n "$label" ]] && [[ -n "$cat1" ]] && [[ -n "$cat2" ]]; then
            LABEL_TO_CAT1["$label"]="$cat1"
            LABEL_TO_CAT2["$label"]="$cat2"
            ((count++)) || true
        fi
    done < "$CLASSES_CSV"

    log_success "Loaded $count label-to-category mappings"
}

# Extract date (YYYY-MM) from file path
extract_date_from_path() {
    local path="$1"
    # Use zsh/bash compatible pattern matching
    # Look for YYYY-MM-DD pattern and extract YYYY-MM
    if [[ "$path" =~ [0-9]{4}-[0-9]{2}-[0-9]{2} ]]; then
        local full_date="${MATCH:-${BASH_REMATCH[0]}}"
        echo "${full_date:0:7}"
    else
        echo "$(command date +%Y-%m)"
    fi
}

# Extract type from path
extract_type_from_path() {
    echo "$1" | cut -d'/' -f1
}

# Get category from label
get_category_for_label() {
    local label="$1"
    local cat1="${LABEL_TO_CAT1[$label]:-}"
    local cat2="${LABEL_TO_CAT2[$label]:-}"

    if [[ -n "$cat1" ]] && [[ -n "$cat2" ]]; then
        echo "$cat1/$cat2"
    fi
}

# Download and parse JSON metadata to extract labels
extract_labels_from_json() {
    local json_path="$1"
    local temp_file
    temp_file=$(mktemp)

    if ! $MC_CMD cat "${MINIO_ALIAS}/${BUCKET}/${json_path}" > "$temp_file" 2>/dev/null; then
        rm -f "$temp_file"
        return
    fi

    local labels
    labels=$(jq -r '.annotations[]?.value?.rectanglelabels[]? // empty' "$temp_file" 2>/dev/null | sort -u | tr '\n' ' ')

    rm -f "$temp_file"
    echo "$labels"
}

# Calculate new path for a file
calculate_new_path() {
    local old_path="$1"
    local labels="$2"

    local file_type
    file_type=$(extract_type_from_path "$old_path")

    local date_month
    date_month=$(extract_date_from_path "$old_path")

    local filename
    filename=$(basename "$old_path")

    local category=""
    for label in $labels; do
        category=$(get_category_for_label "$label")
        if [[ -n "$category" ]]; then
            break
        fi
    done

    if [[ -z "$category" ]]; then
        category="未分类/未分类"
    fi

    echo "${file_type}/${date_month}/${category}/${filename}"
}

# Check if file is already in correct location
is_correct_location() {
    [[ "$1" == "$2" ]]
}

# Move file in MinIO
move_file() {
    local old_path="$1"
    local new_path="$2"

    local source="${MINIO_ALIAS}/${BUCKET}/${old_path}"
    local dest="${MINIO_ALIAS}/${BUCKET}/${new_path}"

    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "[DRY-RUN] Would move: $old_path -> $new_path"
        return 0
    fi

    if $MC_CMD cp "$source" "$dest" --quiet 2>/dev/null; then
        if $MC_CMD rm "$source" --quiet 2>/dev/null; then
            log_verbose "Moved: $old_path -> $new_path"
            return 0
        else
            log_error "Failed to remove source: $old_path"
            return 1
        fi
    else
        log_error "Failed to copy: $old_path -> $new_path"
        return 1
    fi
}

# Process a single file pair
process_file_pair() {
    local image_path="$1"
    local json_path="$2"

    ((TOTAL_FILES++)) || true

    log_verbose "Processing: $image_path"

    local labels
    labels=$(extract_labels_from_json "$json_path")

    if [[ -z "$labels" ]]; then
        log_warn "No labels found for: $image_path"
    fi

    local new_image_path
    new_image_path=$(calculate_new_path "$image_path" "$labels")

    local new_json_path
    new_json_path=$(calculate_new_path "$json_path" "$labels")

    if is_correct_location "$image_path" "$new_image_path"; then
        log_verbose "Already correct: $image_path"
        ((SKIPPED_FILES++)) || true
        return 0
    fi

    if move_file "$image_path" "$new_image_path"; then
        if move_file "$json_path" "$new_json_path"; then
            ((MIGRATED_FILES++)) || true
            return 0
        fi
    fi

    ((ERROR_FILES++)) || true
    return 1
}

# Main migration logic
run_migration() {
    log_info "Starting migration..."

    if [[ "$DRY_RUN" == "true" ]]; then
        log_warn "DRY-RUN MODE - No changes will be made"
    fi

    typeset -a json_files image_files
    json_files=()
    image_files=()
    local key

    while IFS= read -r line; do
        key=$(echo "$line" | jq -r '.key // empty' 2>/dev/null)

        [[ -z "$key" ]] && continue

        if [[ "$key" == *.json ]]; then
            json_files+=("$key")
        else
            image_files+=("$key")
        fi
    done < "$OBJ_LIST"

    log_info "Found ${#image_files[@]} images and ${#json_files[@]} JSON files"

    typeset -A json_lookup
    local base_path
    for json_file in "${json_files[@]}"; do
        base_path="${json_file%.json}"
        json_lookup["$base_path"]="$json_file"
    done

    local image_dir image_name image_base json_path
    for image_path in "${image_files[@]}"; do
        image_dir=$(dirname "$image_path")
        image_name=$(basename "$image_path")
        image_base="${image_name%.*}"
        # Directly construct JSON path from image path
        json_path="${image_dir}/${image_base}.json"

        # Check if JSON exists in our list
        local found=false
        for jf in "${json_files[@]}"; do
            if [[ "$jf" == "$json_path" ]]; then
                found=true
                break
            fi
        done

        if [[ "$found" == "false" ]]; then
            log_verbose "No JSON for: $image_path (expected: $json_path)"
            ((SKIPPED_FILES++)) || true
            ((TOTAL_FILES++)) || true
            continue
        fi

        process_file_pair "$image_path" "$json_path" || true
    done
}

# Print summary
print_summary() {
    echo ""
    echo "=========================================="
    echo "Migration Summary"
    echo "=========================================="
    echo -e "Total files: ${BLUE}$TOTAL_FILES${NC}"
    echo -e "Migrated: ${GREEN}$MIGRATED_FILES${NC}"
    echo -e "Skipped: ${YELLOW}$SKIPPED_FILES${NC}"
    echo -e "Errors: ${RED}$ERROR_FILES${NC}"
    echo "=========================================="

    if [[ "$DRY_RUN" == "true" ]]; then
        log_warn "DRY-RUN: No files were moved"
        log_info "Run without --dry-run to execute"
    fi
}

# Main
main() {
    echo "=========================================="
    echo "MinIO Storage Migration Script"
    echo "=========================================="

    check_prerequisites
    load_category_mapping
    run_migration
    print_summary
}

main "$@"
