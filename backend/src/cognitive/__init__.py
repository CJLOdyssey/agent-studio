"""认知模块 - Cognitive Module

提供智能体认知状态分析、理由对齐和协同训练功能
"""

from cognitive.cognitive_state import CognitiveStateAnalyzer, CognitiveStateReport
from cognitive.collaborative_training import CollaborativeTrainer, LearningExperience
from cognitive.multi_agent_manager import MultiAgentCognitiveManager
from cognitive.reason_alignment import AlignmentReport, ReasonAlignmentEngine

__all__ = [
    "CognitiveStateAnalyzer",
    "CognitiveStateReport",
    "ReasonAlignmentEngine",
    "AlignmentReport",
    "CollaborativeTrainer",
    "LearningExperience",
    "MultiAgentCognitiveManager",
]
