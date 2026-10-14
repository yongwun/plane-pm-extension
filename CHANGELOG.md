# Changelog - Import/Export Bug Fixes and Natural Sort

## 2026-10-14 - fix: import/export data integrity and WBS natural sort

### Bugs Fixed (8 issues)

1. **Missing notes field in TaskPreview** - Added notes field to schemas.py
2. **Content-Disposition encoding** - RFC 5987 UTF-8 filename for Chinese project names
3. **String date in XML builder** - Added date.fromisoformat() conversion
4. **Double datetime suffix** - Added _format_datetime() helper in msproject_xml.py
5. **Date string in baseline creation** - Added date conversion before DB insert
6. **Notes not parsed from import** - Pass notes to TaskPreview in XML/CSV parsers
7. **WBS natural sort** - New natural_sort_key() utility, applied across all queries
8. **Import losing Start/End dates** - Fallback to planned dates when actual dates are null

### Validation
- 16/16 field-by-field round-trip test checks passed
- CSV export, modify all fields, import (overwrite), re-export, compare

### Files Changed
- NEW: backend/app/utils.py
- Modified: routers/gantt.py, import_export.py, baseline.py
- Modified: services/wbs_builder.py, import_export/msproject_xml.py
- Modified: services/import_export/csv_handler.py, schemas.py
