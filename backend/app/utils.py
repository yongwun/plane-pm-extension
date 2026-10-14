"""Shared utility functions."""


def natural_sort_key(code: str | None):
    """
    Return a sort key for natural ordering of WBS-style codes and names.

    Splits strings into numeric and text segments so that:
      "1" < "2" < "10" < "11"  (numeric comparison)
      "1.2" < "1.10" < "2.1"   (hierarchical WBS comparison)
      "1 - Task" < "2 - Task"  (name with sequence prefix)
    """
    if not code:
        return ()
    parts = []
    buf = ""
    for ch in code:
        if ch.isdigit():
            buf += ch
        else:
            if buf:
                parts.append((0, int(buf), buf))
                buf = ""
            if not ch.isspace() and ch not in "-.":
                parts.append((1, 0, ch))
    if buf:
        parts.append((0, int(buf), buf))
    return tuple(parts)
