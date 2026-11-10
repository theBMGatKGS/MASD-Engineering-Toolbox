"""Wrapper: run Calculator Displays E2E against shared synthetic fixtures."""
import os, runpy
os.environ.setdefault('APP', 'file:///workspace/ModuLaser-Battery-Calculator/modulaser_battery_calculator.html')
os.environ.setdefault('RPT', 'file:///workspace/ModuLaser-Commisioning-Report/index.html')
runpy.run_path('/workspace/ModuLaser-Battery-Calculator/tests/pl_display_assign_e2e.py', run_name='__main__')
