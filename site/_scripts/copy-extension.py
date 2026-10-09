"""
Pre-render: copies the repository's _extensions/ into the site, so the demo uses the current extension.

A symbolic link would be simpler, but installers refuse archives that contain one
(Quarto Wizard: 'Archive contains a symbolic link ... which is not permitted').
"""
import shutil
from pathlib import Path

SITE = Path(__file__).resolve().parent.parent
shutil.rmtree(SITE / "_extensions", ignore_errors=True)
shutil.copytree(SITE.parent / "_extensions", SITE / "_extensions")
