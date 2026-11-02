"""Add D8's generated dex files to the aapt2-generated APK before signing."""
from pathlib import Path
import sys
from zipfile import ZipFile, ZIP_DEFLATED
apk, folder = Path(sys.argv[1]), Path(sys.argv[2])
with ZipFile(apk, 'a', ZIP_DEFLATED) as archive:
    for dex in sorted(folder.glob('classes*.dex')):
        archive.write(dex, dex.name)
