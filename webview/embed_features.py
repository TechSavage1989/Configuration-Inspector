from pathlib import Path

root = Path(__file__).resolve().parent
page = root / 'index.html'
source = page.read_text()
start = source.index('<script id="fundamental-features">')
end = source.index('</script>', start)
source = source[:start] + '<script id="fundamental-features">\n' + (root / 'features.js').read_text() + '\n' + source[end:]
marker = '<script id="security-features">'
if marker not in source:
    end = source.index('</script>', source.index('<script id="fundamental-features">')) + len('</script>')
    source = source[:end] + '\n' + marker + '\n</script>' + source[end:]
start = source.index(marker)
end = source.index('</script>', start)
source = source[:start] + marker + '\n' + (root / 'security.js').read_text() + '\n' + source[end:]
marker = '<script id="network-features">'
if marker not in source:
    end = source.index('</script>', source.index('<script id="security-features">')) + len('</script>')
    source = source[:end] + '\n' + marker + '\n</script>' + source[end:]
start = source.index(marker)
end = source.index('</script>', start)
source = source[:start] + marker + '\n' + (root / 'network.js').read_text() + '\n' + source[end:]
marker = '<script id="hardware-layouts">'
if marker not in source:
    end = source.index('</script>', source.index('<script id="network-features">')) + len('</script>')
    source = source[:end] + '\n' + marker + '\n</script>' + source[end:]
start = source.index(marker)
end = source.index('</script>', start)
source = source[:start] + marker + '\n' + (root / 'hardware.js').read_text() + '\n' + source[end:]
marker = '<script id="device-specifications">'
if marker not in source:
    end = source.index('</script>', source.index('<script id="network-features">')) + len('</script>')
    source = source[:end] + '\n' + marker + '\n</script>' + source[end:]
start = source.index(marker)
end = source.index('</script>', start)
source = source[:start] + marker + '\n' + (root / 'device_specs.js').read_text() + '\n' + source[end:]
marker = '<script id="app-storage">'
if marker not in source:
    end = source.index('</script>', source.index('<script id="device-specifications">')) + len('</script>')
    source = source[:end] + '\n' + marker + '\n</script>' + source[end:]
start = source.index(marker)
end = source.index('</script>', start)
source = source[:start] + marker + '\n' + (root / 'app_storage.js').read_text() + '\n' + source[end:]
marker = '<script id="filter-categories">'
if marker not in source:
    end = source.index('</script>', source.index('<script id="security-features">')) + len('</script>')
    source = source[:end] + '\n' + marker + '\n</script>' + source[end:]
start = source.index(marker)
end = source.index('</script>', start)
source = source[:start] + marker + '\n' + (root / 'filter_categories.js').read_text() + '\n' + source[end:]
page.write_text(source)

marker = '<script id="configuration-review">'
if marker not in source:
    end = source.index('</script>', source.index('<script id="app-storage">')) + len('</script>')
    source = source[:end] + '\n' + marker + '\n</script>' + source[end:]
start = source.index(marker)
end = source.index('</script>', start)
source = source[:start] + marker + '\n' + (root / 'review.js').read_text() + '\n' + source[end:]
page.write_text(source)

marker = '<script id="mikrotik-importer">'
if marker not in source:
    end = source.index('<script id="fundamental-features">')
    source = source[:end] + marker + '\n</script>\n' + source[end:]
start = source.index(marker)
end = source.index('</script>', start)
source = source[:start] + marker + '\n' + (root / 'mikrotik.js').read_text() + '\n' + source[end:]
page.write_text(source)

marker = '<script id="app-updates">'
if marker not in source:
    end = source.index('</script>', source.index('<script id="app-storage">')) + len('</script>')
    source = source[:end] + '\n' + marker + '\n</script>' + source[end:]
start = source.index(marker)
end = source.index('</script>', start)
source = source[:start] + marker + '\n' + (root / 'updates.js').read_text() + '\n' + source[end:]
page.write_text(source)

# Comparison modules precede the application controller in the single-file build.
for script_id, filename in [('comparison-engine', 'comparison.js'), ('comparison-ui', 'comparison_ui.js')]:
    marker = '<script id="' + script_id + '">'
    if marker not in source:
        anchor = source.index('<script id="app-updates">')
        source = source[:anchor] + marker + '\n</script>\n' + source[anchor:]
    start = source.index(marker)
    end = source.index('</script>', start)
    source = source[:start] + marker + '\n' + (root / filename).read_text() + '\n' + source[end:]
page.write_text(source)
