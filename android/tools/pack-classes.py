"""Pack compiled classes for the Android D8 compiler without requiring JDK jar."""
from pathlib import Path
import sys
from zipfile import ZipFile, ZIP_DEFLATED
folder, output = Path(sys.argv[1]), Path(sys.argv[2])
with ZipFile(output, 'w', ZIP_DEFLATED) as archive:
    for item in sorted(folder.rglob('*.class')):
        archive.write(item, item.relative_to(folder).as_posix())
