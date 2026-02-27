"""
体态检测服务主入口（V2修复版）

这是一个绕过代码缓存的临时服务文件，直接导入旧服务但重命名方法
"""
import sys
import importlib

# 强制重新加载旧服务模块
if 'services.posture_service' in sys.modules:
    del sys.modules['services.posture_service']

# 导入旧服务并重用
from services.posture_service import PostureAssessmentService as _OriginalPostureAssessmentService

# 创建新的服务类，继承但不重写任何方法
class PostureAssessmentServiceV2(_OriginalPostureAssessmentService):
    """
    V1服务类的包装器
    这个类只是为了绕过Python模块缓存问题
    """
    pass

# 创建全局实例
posture_service_v2 = PostureAssessmentServiceV2()
