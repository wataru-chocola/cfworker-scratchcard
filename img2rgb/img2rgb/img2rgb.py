import os
import sys

import click
from PIL import Image


@click.command()
@click.option("--src", default="src", metavar="DIR", help="Source directory of images")
@click.option("--out", default="out", metavar="DIR", help="Output directory of images")
def main(src: str, out: str) -> None:
    if not os.path.exists(src):
        os.makedirs(src)

    if not os.path.exists(out):
        os.makedirs(out)

    for entry in os.scandir(src):
        sys.stdout.write(f"+ found {entry.name} in {src}\n")
        srcpath = os.path.join(src, entry.name)
        if not os.path.isfile(srcpath):
            sys.stdout.write("++ skip\n")
            continue
        sys.stdout.write("++ convert into RGBA\n")
        rgba = Image.open(srcpath).convert("RGBA")
        rgbadata = rgba.tobytes()
        outpath = os.path.join(out, entry.name + ".bin")
        sys.stdout.write(f"++ save: {outpath}\n")
        with open(outpath, "wb") as f:
            f.write(rgbadata)
