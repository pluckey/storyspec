"""Merges JUnit reports into one, for the trace: python3 scripts/merge_junit.py OUT IN..."""
import sys
import xml.etree.ElementTree as ET

out, *inputs = sys.argv[1:]
merged = ET.Element("testsuites")
for path in inputs:
    try:
        root = ET.parse(path).getroot()
    except (FileNotFoundError, ET.ParseError):
        continue
    merged.extend(root.findall("testsuite") if root.tag == "testsuites" else [root])
ET.ElementTree(merged).write(out, encoding="utf-8", xml_declaration=True)
