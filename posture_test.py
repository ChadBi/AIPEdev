"""
测试体态检测流程

用于调试和验证体态检测的各个步骤
"""

import asyncio
import base64
from typing import Dict, Any
from datetime import datetime
import logging

logging.basicConfig(level=logging.DEBUG, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


def create_test_image_base64(width: int = 640, height: int = 480) -> str:
    """创建一个测试图像的base64编码"""
    import numpy as np
    import cv2

    # 创建一个简单的测试图像：一个带有轮廓的背景（模拟人体）
    img = np.zeros((height, width, 3), dtype=np.uint8)
    img[:] = (200, 200, 200)  # 灰色背景

    # 画一个简单的人体轮廓（粗略模拟）
    # 头部
    cv2.circle(img, (width//2, 80), 40, (100, 100, 100), -1)
    # 身体
    cv2.rectangle(img, (width//2-30, 120), (width//2+30, 300), (100, 100, 100), -1)
    # 腿
    cv2.rectangle(img, (width//2-25, 300), (width//2-5, 400), (100, 100, 100), -1)
    cv2.rectangle(img, (width//2+5, 300), (width//2+25, 400), (100, 100, 100), -1)
    # 手臂
    cv2.rectangle(img, (width//2-30, 120), (width//2-60, 200), (100, 100, 100), -1)
    cv2.rectangle(img, (width//2+30, 120), (width//2+60, 200), (100, 100, 100), -1)

    _, buffer = cv2.imencode('.jpg', img)
    return base64.b64encode(buffer).decode('utf-8')


async def test_step_1_keypoint_recognition():
    """测试步骤1: 关键点识别"""
    logger.info("=" * 60)
    logger.info("步骤1: 测试关键点识别")
    logger.info("=" * 60)

    try:
        from services.recognition_service import recognize_frame_base64

        logger.info("创建测试图像...")
        image_base64 = create_test_image_base64()

        logger.info("开始关键点识别...")
        start_time = datetime.now()

        keypoints = recognize_frame_base64(image_base64)

        elapsed = (datetime.now() - start_time).total_seconds()
        logger.info(f"✓ 关键点识别完成，耗时 {elapsed:.2f} 秒")
        logger.info(f"✓ 检测到 {len(keypoints)} 个关键点")

        return keypoints

    except Exception as e:
        logger.error(f"✗ 关键点识别失败: {e}")
        import traceback
        traceback.print_exc()
        return None


async def test_step_2_keypoint_normalization():
    """测试步骤2: 关键点规范化"""
    logger.info("=" * 60)
    logger.info("步骤2: 测试关键点规范化")
    logger.info("=" * 60)

    try:
        from services.posture_analysis_service import PostureAnalyzer

        analyzer = PostureAnalyzer()

        # 获取关键点
        keypoints = await test_step_1_keypoint_recognition()
        if not keypoints or len(keypoints) == 0:
            logger.warning("跳过规范化测试，无关键点数据")
            return None

        logger.info("开始关键点规范化...")
        start_time = datetime.now()

        normalized = analyzer.normalize_keypoints(keypoints)

        elapsed = (datetime.now() - start_time).total_seconds()
        logger.info(f"✓ 关键点规范化完成，耗时 {elapsed:.2f} 秒")
        logger.info(f"✓ 规范化后关键点数量: {len(normalized)}")

        return normalized

    except Exception as e:
        logger.error(f"✗ 关键点规范化失败: {e}")
        import traceback
        traceback.print_exc()
        return None


async def test_step_3_single_angle_analysis():
    """测试步骤3: 单角度分析"""
    logger.info("=" * 60)
    logger.info("步骤3: 测试单角度分析")
    logger.info("=" * 60)

    try:
        from services.posture_analysis_service import PostureAnalyzer

        analyzer = PostureAnalyzer()

        # 获取规范化关键点
        keypoints = await test_step_2_keypoint_normalization()
        if not keypoints:
            logger.warning("跳过单角度分析测试，无关键点数据")
            return None

        logger.info("开始正面角度分析...")
        start_time = datetime.now()

        analysis = analyzer.analyze_single_angle(keypoints, 'front')

        elapsed = (datetime.now() - start_time).total_seconds()
        logger.info(f"✓ 单角度分析完成，耗时 {elapsed:.2f} 秒")
        logger.info(f"✓ 质量评分: {analysis['quality_score']:.2f}")
        logger.info(f"✓ 缺失关键点: {analysis['missing_keypoints']}")

        return analysis

    except Exception as e:
        logger.error(f"✗ 单角度分析失败: {e}")
        import traceback
        traceback.print_exc()
        return None


async def test_step_4_multiview_analysis():
    """测试步骤4: 多角度分析"""
    logger.info("=" * 60)
    logger.info("步骤4: 测试多角度分析")
    logger.info("=" * 60)

    try:
        from services.posture_analysis_service import PostureAnalyzer

        analyzer = PostureAnalyzer()

        # 模拟多角度关键点
        keypoints_by_angle = {}

        for angle in ['front', 'left_side', 'right_side', 'back']:
            logger.info(f"处理 {angle} 角度...")
            keypoints = await test_step_1_keypoint_recognition()
            if keypoints and len(keypoints) > 0:
                normalized = analyzer.normalize_keypoints(keypoints)
                keypoints_by_angle[angle] = normalized

        if not keypoints_by_angle:
            logger.warning("跳过多角度分析测试，无关键点数据")
            return None

        logger.info(f"共有 {len(keypoints_by_angle)} 个角度的关键点数据")

        logger.info("开始多角度分析...")
        start_time = datetime.now()

        analysis = analyzer.analyze_multiview_posture(keypoints_by_angle)

        elapsed = (datetime.now() - start_time).total_seconds()
        logger.info(f"✓ 多角度分析完成，耗时 {elapsed:.2f} 秒")
        logger.info(f"✓ 检测到 {len(analysis.get('issues', []))} 个体态问题")

        return analysis

    except Exception as e:
        logger.error(f"✗ 多角度分析失败: {e}")
        import traceback
        traceback.print_exc()
        return None


async def test_step_5_scoring():
    """测试步骤5: 评分计算"""
    logger.info("=" * 60)
    logger.info("步骤5: 测试评分计算")
    logger.info("=" * 60)

    try:
        from services.posture_scoring_service import PostureScoringEngine

        scoring_engine = PostureScoringEngine()

        # 获取分析结果
        analysis = await test_step_4_multiview_analysis()
        if not analysis:
            logger.warning("跳过评分计算测试，无分析结果")
            return None

        logger.info("开始评分计算...")
        start_time = datetime.now()

        score_result = scoring_engine.calculate_overall_score(
            analysis.get('metrics', {}),
            analysis.get('issues', [])
        )

        elapsed = (datetime.now() - start_time).total_seconds()
        logger.info(f"✓ 评分计算完成，耗时 {elapsed:.2f} 秒")
        logger.info(f"✓ 综合评分: {score_result['overall_score']:.2f}")
        logger.info(f"✓ 等级: {score_result['grade']}")

        return score_result

    except Exception as e:
        logger.error(f"✗ 评分计算失败: {e}")
        import traceback
        traceback.print_exc()
        return None


async def test_full_workflow():
    """测试完整的体态检测工作流程"""
    logger.info("")
    logger.info("╔" + "═" * 58 + "╗")
    logger.info("║" + " " * 15 + "体态检测流程测试" + " " * 28 + "║")
    logger.info("╚" + "═" * 58 + "╝")
    logger.info("")

    start_time = datetime.now()

    results = {}

    # 依次测试各个步骤
    results['keypoint_recognition'] = await test_step_1_keypoint_recognition()
    results['keypoint_normalization'] = await test_step_2_keypoint_normalization()
    results['single_angle_analysis'] = await test_step_3_single_angle_analysis()
    results['multiview_analysis'] = await test_step_4_multiview_analysis()
    results['scoring'] = await test_step_5_scoring()

    # 总结
    total_elapsed = (datetime.now() - start_time).total_seconds()

    logger.info("")
    logger.info("=" * 60)
    logger.info("测试总结")
    logger.info("=" * 60)
    logger.info(f"总耗时: {total_elapsed:.2f} 秒")

    completed_steps = sum(1 for v in results.values() if v is not None)
    logger.info(f"完成步骤: {completed_steps}/{len(results)}")

    if completed_steps == len(results):
        logger.info("✓ 所有测试步骤完成")
    else:
        logger.warning("✗ 部分测试步骤失败")

    return results


if __name__ == "__main__":
    asyncio.run(test_full_workflow())
