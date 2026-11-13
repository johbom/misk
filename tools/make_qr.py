#!/usr/bin/env python3
"""Skapar icons/qr-app.svg: QR-kod till appens webbadress (visas överst i Om-rutan).

Kräver paketet segno (pip install segno). QR-koden är en vanlig fil, så den fungerar
utan internet och utan någon extern QR-tjänst.
"""
import io, pathlib, segno

URL = 'https://johbom.github.io/misk/'
OUT = pathlib.Path(__file__).resolve().parent.parent / 'icons' / 'qr-app.svg'

qr = segno.make(URL, error='m', micro=False)  # segno höjer felkorrigeringen om det får plats
buf = io.BytesIO()
qr.save(buf, kind='svg', border=2, dark='#000', light='#fff', omitsize=True, xmldecl=False,
        svgns=True, nl=False, title='QR-kod till johbom.github.io/misk')
OUT.write_text(buf.getvalue().decode().replace('<svg ', '<svg shape-rendering="crispEdges" ', 1))
print(OUT, qr.version, qr.error)
