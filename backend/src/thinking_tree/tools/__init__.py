"""工具插件自动发现。

本目录下所有模块在启动时被导入，触发它们向 ToolRegistry 自注册。
"""

import importlib
import pkgutil

__path__ = __path__

for _loader, _module_name, _is_pkg in pkgutil.iter_modules(__path__):
    if _module_name != "__init__":
        importlib.import_module(f"{__name__}.{_module_name}")
