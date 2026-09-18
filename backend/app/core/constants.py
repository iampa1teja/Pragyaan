from enum import Enum 

class Mode(str, Enum): 
    CHAT = "chat"
    INTERVIEW = "interview" 
    PERSPECTIVE = "perspective" 
    DIVERGENCE = "divergence" 
    ANALYSIS = "analysis"

class AgentName(str, Enum): 
    ORCHESTRATOR = "orchestrator" 
    CONTEXT = "context" 
    INTERVIEW = "interview" 
    PERPECTIVE = "perspective" 
    DIVERGENCE = "divergence" 
    ANALYSIS = "analysis" 

CONTEXT_SECTIONS = ["Characters", "Scenes", "Timeline", "Branches", "Assets"] 
OUTLINE_START="<!-- OUTLINE -->"
OUTLINE_END="<!-- /OUTLINE -->"