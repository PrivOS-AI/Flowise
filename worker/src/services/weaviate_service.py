"""
Wrapper for the existing Weaviate service
"""

# Import the existing service from the worker module
import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '../../..'))

from worker.apps.services.weaviate_service import weaviate_service