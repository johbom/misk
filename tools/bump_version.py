# Höjer versionen inför en ny release: VERSION i sw.js och ?v= på css/js i index.html,
# så att telefoner och installerade appar säkert hämtar de nya filerna.
# Kör: python3 tools/bump_version.py
import re, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
sw = root / 'sw.js'
s = sw.read_text()
n = int(re.search(r"hover-pads-v(\d+)", s).group(1)) + 1
sw.write_text(re.sub(r"hover-pads-v\d+", f"hover-pads-v{n}", s))
idx = root / 'index.html'
idx.write_text(re.sub(r'\?v=\d+"', f'?v={n}"', idx.read_text()))
print(f'version {n}')
