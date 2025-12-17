"""
Wrapper for the existing MongoDB service
"""

# Import the existing service from the worker module
import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '../../..'))

from worker.apps.services.mongodb import mongodb_service