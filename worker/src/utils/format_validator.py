"""
Wrapper for the existing format validator utility
"""

# Import the existing utility from the worker module
import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '../../..'))

from worker.apps.utils.format_validator import format_validation_error