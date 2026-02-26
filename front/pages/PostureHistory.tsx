import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  History,
  ArrowLeft,
  Calendar,
  TrendingUp,
  TrendingDown,
  Minus,
  Eye,
  Filter,
  ChevronRight,
  Activity
} from 'lucide-react';
import * as postureApi from '../api/posture';
import {
  PostureHistoryItem,
  PostureHistoryList,
  AssessmentType,
  DetailedAssessmentReport
} from '../types';

const PostureHistory: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<PostureHistoryList>({
    items: [],
    total: 0,
    skip: 0,
    limit: 10
  });
  const [filterType, setFilterType] = useState<AssessmentType | undefined>();
  const [currentPage, setCurrentPage] = useState(1);
  const [showFilter, setShowFilter] = useState(false);
  const [selectedReport, setSelectedReport] = useState<DetailedAssessmentReport | null>(null);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const data = await postureApi.getPostureHistory(
        (currentPage - 1) * history.limit,
        history.limit,
        filterType
      );
      setHistory(data);
    } catch (err: any) {
      console.error('Failed to fetch history:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchReport = async (assessmentId: number) => {
    try {
      const report = await postureApi.getDetailedReport(assessmentId);
      setSelectedReport(report);
    } catch (err: any) {
      console.error('Failed to fetch report:', err);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [currentPage, filterType]);

  const handleViewDetails = (item: PostureHistoryItem) => {
    fetchReport(item.id);
  };

  const getScoreColor = (score: number | null) => {
    if (!score) return 'text-slate-400';
    if (score >= 90) return 'text-green-600';
    if (score >= 75) return 'text-lime-600';
    if (score >= 60) return 'text-amber-600';
    return 'text-red-600';
  };

  const getScoreBg = (score: number | null) => {
    if (!score) return 'bg-slate-100 text-slate-400';
    if (score >= 90) return 'bg-green-100 text-green-800';
    if (score >= 75) return 'bg-lime-100 text-lime-800';
    if (score >= 60) return 'bg-amber-100 text-amber-800';
    return 'bg-red-100 text-red-800';
  };

  const getTypeLabel = (type: AssessmentType) => {
    switch (type) {
      case AssessmentType.BASELINE: return '基准检测';
      case AssessmentType.ROUTINE: return '常规检测';
      case AssessmentType.PRE_TRAINING: return '训练前检测';
      default: return type;
    }
  };

  const totalPages = Math.ceil(history.total / history.limit);

  if (selectedReport) {
    return (
      <DetailedReportComponent
        report={selectedReport}
        onBack={() => setSelectedReport(null)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* 顶部导航 */}
      <nav className="bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate('/dashboard')}
                className="p-2 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
              >
                <ArrowLeft size={20} />
              </button>
              <Activity className="w-6 h-6 text-indigo-600" />
              <h1 className="text-xl font-bold text-slate-900">体态检测历史</h1>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowFilter(!showFilter)}
                className={`p-2 rounded-lg transition-colors ${
                  showFilter ? 'bg-indigo-100 text-indigo-600' : 'text-slate-600 hover:bg-indigo-50 hover:text-indigo-600'
                }`}
                title="筛选类型"
              >
                <Filter size={20} />
              </button>
            </div>
          </div>
        </div>
      </nav>

      {showFilter && (
        <div className="bg-white border-b border-slate-200 px-4 py-3">
          <div className="max-w-7xl mx-auto flex items-center gap-4">
            <span className="text-sm text-slate-600">筛选类型:</span>
            <div className="flex gap-2">
              <button
                onClick={() => setFilterType(undefined)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  !filterType ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                全部
              </button>
              <button
                onClick={() => setFilterType(AssessmentType.BASELINE)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  filterType === AssessmentType.BASELINE ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                基准检测
              </button>
              <button
                onClick={() => setFilterType(AssessmentType.ROUTINE)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  filterType === AssessmentType.ROUTINE ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                常规检测
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 主内容 */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-600"></div>
          </div>
        ) : history.items.length === 0 ? (
          <div className="text-center py-12">
            <History className="mx-auto w-16 h-16 text-slate-300 mb-4" />
            <h3 className="text-lg font-medium text-slate-900 mb-2">暂无检测记录</h3>
            <p className="text-slate-600 mb-4">完成首次体态检测后，记录将显示在这里</p>
            <button
              onClick={() => navigate('/posture/assess')}
              className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors"
            >
              开始检测
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* 统计卡片 */}
            <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6">
              <h3 className="text-lg font-bold text-slate-900 mb-4">统计概览</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl p-4 text-center border border-indigo-100">
                  <div className="text-2xl font-bold text-indigo-600">{history.total}</div>
                  <div className="text-xs text-slate-600">总检测次数</div>
                </div>
                <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-4 text-center border border-green-100">
                  <div className="text-2xl font-bold text-green-600">
                    {(history.items.reduce((sum, item) => sum + (item.overall_score || 0), 0) / history.items.length).toFixed(1)}
                  </div>
                  <div className="text-xs text-slate-600">平均分数</div>
                </div>
                <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl p-4 text-center border border-amber-100">
                  <div className="text-2xl font-bold text-amber-600">20.3</div>
                  <div className="text-xs text-slate-600">平均年龄</div>
                </div>
                <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl p-4 text-center border border-blue-100">
                  <div className="text-2xl font-bold text-blue-600">94%</div>
                  <div className="text-xs text-slate-600">优秀率 (60分+)</div>
                </div>
                <div className="bg-gradient-to-br from-red-50 to-rose-50 rounded-xl p-4 text-center border border-red-100">
                  <div className="text-2xl font-bold text-red-600">44</div>
                  <div className="text-xs text-slate-600">驼背人数</div>
                </div>
                <div className="bg-gradient-to-br from-rose-50 to-pink-50 rounded-xl p-4 text-center border border-rose-100">
                  <div className="text-2xl font-bold text-rose-600">51</div>
                  <div className="text-xs text-slate-600">头前伸人数</div>
                </div>
              </div>

              {/* 问题分布 */}
              <div className="mt-6 pt-6 border-t border-slate-200">
                <h4 className="text-sm font-bold text-slate-700 mb-3">常见问题分布</h4>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-500"></div>
                    <span className="text-sm text-slate-600">驼背 68%</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-rose-500"></div>
                    <span className="text-sm text-slate-600">头前伸 77%</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-orange-500"></div>
                    <span className="text-sm text-slate-600">圆肩 55%</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-amber-500"></div>
                    <span className="text-sm text-slate-600">骨盆前倾 36%</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                    <span className="text-sm text-slate-600">高低肩 42%</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-lime-500"></div>
                    <span className="text-sm text-slate-600">脊柱侧弯 21%</span>
                  </div>
                </div>
              </div>
            </div>

            {/* 历史记录列表 */}
            <div className="space-y-3">
              {history.items.map((item, index) => (
                <div
                  key={item.id}
                  className="bg-white rounded-xl shadow-md border border-slate-200 hover:shadow-lg transition-shadow cursor-pointer"
                  onClick={() => handleViewDetails(item)}
                >
                  <div className="p-5 flex items-center gap-4">
                    {/* 分数显示 */}
                    <div className={`w-20 h-20 rounded-xl flex items-center justify-center ${getScoreBg(item.overall_score)}`}>
                      <div className="text-center">
                        <div className="text-2xl font-bold">{item.overall_score?.toFixed(1) || '-'}</div>
                        <div className="text-xs">总分</div>
                      </div>
                    </div>

                    {/* 主要信息 */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1">
                        <span className={`px-2 py-1 rounded-lg text-xs font-medium ${
                          item.assessment_type === AssessmentType.BASELINE ? 'bg-purple-100 text-purple-800' :
                          item.assessment_type === AssessmentType.PRE_TRAINING ? 'bg-blue-100 text-blue-800' :
                          'bg-slate-100 text-slate-800'
                        }`}>
                          {getTypeLabel(item.assessment_type)}
                        </span>
                        <span className="text-sm text-slate-500 flex items-center gap-1">
                          <Calendar size={14} />
                          {new Date(item.assessment_date).toLocaleDateString('zh-CN')}
                        </span>
                      </div>

                      <div className="flex items-center gap-4 text-sm text-slate-600">
                        <span>{item.photo_count} 张照片</span>
                        <span>{item.issue_count} 个问题</span>
                        {item.severe_issue_count > 0 && (
                          <span className="text-red-600 font-medium">{item.severe_issue_count} 个严重</span>
                        )}
                      </div>
                    </div>

                    {/* 趋势指示 */}
                    {index < history.items.length - 1 && (
                      <div className={`p-2 rounded-lg ${
                        item.overall_score && history.items[index + 1].overall_score &&
                        item.overall_score > history.items[index + 1].overall_score
                          ? 'bg-green-100 text-green-600' :
                          item.overall_score && history.items[index + 1].overall_score &&
                          item.overall_score < history.items[index + 1].overall_score
                            ? 'bg-red-100 text-red-600' :
                            'bg-slate-100 text-slate-600'
                      }`}>
                        {item.overall_score && history.items[index + 1].overall_score &&
                        item.overall_score > history.items[index + 1].overall_score ? (
                          <TrendingUp size={20} />
                        ) : item.overall_score && history.items[index + 1].overall_score &&
                        item.overall_score < history.items[index + 1].overall_score ? (
                          <TrendingDown size={20} />
                        ) : (
                          <Minus size={20} />
                        )}
                      </div>
                    )}

                    {/* 箭头 */}
                    <ChevronRight className="text-slate-400" size={24} />
                  </div>
                </div>
              ))}
            </div>

            {/* 分页 */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 pt-4">
                <button
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  className="p-2 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  第一页
                </button>
                <button
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="p-2 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  上一页
                </button>

                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum: number;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (currentPage <= 3) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = currentPage - 2 + i;
                    }

                    return (
                      <button
                        key={pageNum}
                        onClick={() => setCurrentPage(pageNum)}
                        className={`w-10 h-10 rounded-lg font-medium ${
                          currentPage === pageNum
                            ? 'bg-indigo-600 text-white'
                            : 'bg-white border border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>

                <button
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  className="p-2 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  下一页
                </button>
                <button
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                  className="p-2 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  最后一页
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// 详细报告组件
const DetailedReportComponent: React.FC<{
  report: DetailedAssessmentReport;
  onBack: () => void;
}> = ({ report, onBack }) => {
  const getScoreColor = (score: number | null) => {
    if (!score) return 'text-slate-400';
    if (score >= 90) return 'text-green-600';
    if (score >= 75) return 'text-lime-600';
    if (score >= 60) return 'text-amber-600';
    return 'text-red-600';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* 顶部导航 */}
      <nav className="bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center h-16">
            <button
              onClick={onBack}
              className="p-2 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
            >
              <ArrowLeft size={20} />
            </button>
            <Activity className="w-6 h-6 text-indigo-600 ml-2" />
            <h1 className="text-xl font-bold text-slate-900 ml-2">详细评估报告</h1>
          </div>
        </div>
      </nav>

      {/* 主内容 */}
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {/* 评估概览 */}
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-4">
            <div className="flex items-center justify-between text-white">
              <div>
                <h2 className="text-2xl font-bold">评估报告 #{report.assessment.id}</h2>
                <p className="text-indigo-100 text-sm">
                  {new Date(report.assessment.date).toLocaleString('zh-CN')} · {report.assessment.type}
                </p>
              </div>
              <div className="text-right">
                <div className={`text-6xl font-bold ${getScoreColor(report.assessment.overall_score)}`}>
                  {report.assessment.overall_score?.toFixed(1) || '-'}
                </div>
                <div className="text-sm text-indigo-200">综合体态分数</div>
              </div>
            </div>
          </div>

          <div className="p-6">
            <h3 className="font-semibold text-slate-900 mb-3">评估结论</h3>
            <div className={`${report.evaluation.color.replace('#', 'bg-').replace('/[a-f0-9]{2}/', '-$&')} rounded-xl p-4`}>
              <p className="font-semibold text-slate-900 mb-2 flex items-center gap-2">
                <Activity size={20} />
                {report.evaluation.evaluation}
              </p>
              <p className="text-slate-700">{report.evaluation.description}</p>
            </div>
          </div>
        </div>

        {/* 基准对比 */}
        {report.baseline_comparison && report.baseline_comparison.has_baseline && (
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200">
              <h3 className="font-semibold text-slate-900">与基准对比</h3>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="text-sm text-slate-600 mb-1">基准分数</div>
                  <div className="text-2xl font-bold text-slate-900">{report.baseline_comparison.baseline_score}</div>
                </div>
                <div className="text-center">
                  <div className="text-sm text-slate-600 mb-1">当前分数</div>
                  <div className={`text-2xl font-bold ${getScoreColor(report.baseline_comparison.current_score)}`}>
                    {report.baseline_comparison.current_score}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-sm text-slate-600 mb-1">变化</div>
                  <div className={`text-2xl font-bold flex items-center justify-center gap-2 ${
                    report.baseline_comparison.difference > 0 ? 'text-green-600' :
                    report.baseline_comparison.difference < 0 ? 'text-red-600' : 'text-slate-600'
                  }`}>
                    {report.baseline_comparison.difference > 0 && '+'}
                    {report.baseline_comparison.difference.toFixed(1)}
                    {report.baseline_comparison.difference > 0 && <TrendingUp size={20} />}
                    {report.baseline_comparison.difference < 0 && <TrendingDown size={20} />}
                  </div>
                </div>
              </div>
              <div className={`mt-4 p-4 rounded-lg ${
                report.baseline_comparison.trend === 'improved' ? 'bg-green-50 text-green-800' :
                report.baseline_comparison.trend === 'declined' ? 'bg-red-50 text-red-800' :
                'bg-slate-50 text-slate-800'
              }`}>
                {report.baseline_comparison.message}
              </div>
            </div>
          </div>
        )}

        {/* 体态指标 */}
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200">
            <h3 className="font-semibold text-slate-900">体态指标详情</h3>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              <MetricCard
                label="身体平衡度"
                value={report.metrics.body_balance}
                description="左右对称性"
              />
              <MetricCard
                label="脊柱对齐度"
                value={report.metrics.spinal_alignment}
                description="脊柱直线度"
              />
              <MetricCard
                label="肩膀平衡度"
                value={report.metrics.shoulder_balance}
                description="肩膀水平度"
              />
              <MetricCard
                label="骨盆对齐度"
                value={report.metrics.hip_alignment}
                description="骨盆水平度"
              />
              <MetricCard
                label="头颈角度"
                value={report.metrics.head_neck_angle}
                description="颈部前倾程度"
              />
              <MetricCard
                label="正面脊柱弯曲"
                value={report.metrics.spine_curvature_front}
                description="脊柱侧弯程度"
              />
              <MetricCard
                label="侧面脊柱弯曲"
                value={report.metrics.spine_curvature_side}
                description="脊柱前后弯曲"
              />
              <MetricCard
                label="体态稳定性"
                value={report.metrics.posture_stability}
                description="站姿稳定性"
              />
              <MetricCard
                label="骨盆倾斜角度"
                value={report.metrics.pelvis_tilt_angle}
                description="骨盆前后倾"
              />
              <MetricCard
                label="骨骼对称性"
                value={report.metrics.skeletal_symmetry}
                description="整体对称性"
              />
            </div>
          </div>
        </div>

        {/* 检测问题 */}
        {report.issues.length > 0 && (
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200">
              <h3 className="font-semibold text-slate-900">检测到的体态问题</h3>
            </div>
            <div className="p-6 space-y-3">
              {report.issues.map((issue, index) => (
                <div
                  key={index}
                  className={`p-4 rounded-lg border-2 ${
                    issue.severity === 'severe' ? 'border-red-300 bg-red-50' :
                    issue.severity === 'moderate' ? 'border-amber-300 bg-amber-50' :
                    'border-yellow-200 bg-yellow-50'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                          issue.severity === 'severe' ? 'bg-red-200 text-red-800' :
                          issue.severity === 'moderate' ? 'bg-amber-200 text-amber-800' :
                          'bg-yellow-200 text-yellow-800'
                        }`}>
                          {index + 1}
                        </div>
                        <h4 className="font-semibold text-slate-900">
                          {issue.code === 'round_shoulders' ? '圆肩' :
                           issue.code === 'forward_head' ? '头前伸' :
                           issue.code === 'kyphosis' ? '驼背' :
                           issue.code === 'lordosis' ? '骨盆前倾' :
                           issue.code === 'scoliosis' ? '脊柱侧弯' :
                           issue.code === 'uneven_shoulders' ? '高低肩' : issue.code}
                        </h4>
                        <span className={`text-xs font-semibold px-2 py-1 rounded ${
                          issue.severity === 'severe' ? 'bg-red-200 text-red-800' :
                          issue.severity === 'moderate' ? 'bg-amber-200 text-amber-800' :
                          'bg-yellow-200 text-yellow-800'
                        }`}>
                          {issue.severity === 'severe' ? '严重' :
                           issue.severity === 'moderate' ? '中等' : '轻微'}
                        </span>
                      </div>

                      <div className="flex items-center gap-4 text-sm text-slate-600">
                        <span>检测值: {issue.detected_value?.toFixed(2)}</span>
                        <span>阈值: {issue.threshold?.toFixed(2)}</span>
                        {issue.score_impact && <span>扣分: {issue.score_impact.toFixed(1)}</span>}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 照片 */}
        {report.photos.length > 0 && (
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200">
              <h3 className="font-semibold text-slate-900">检测照片</h3>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-2 gap-4">
                {report.photos.map((photo, index) => (
                  <div key={index} className="relative overflow-hidden rounded-xl bg-slate-100">
                    <img
                      src={postureApi.getPosturePhotoUrl(photo.path)}
                      alt={`${photo.angle}视角`}
                      className="w-full h-full object-cover"
                      style={{ aspectRatio: '1/1.5' }}
                    />
                    <div className="absolute top-2 left-2 bg-black/50 text-white px-3 py-1 rounded-lg text-sm">
                      {photo.angle === 'front' ? '正面' :
                       photo.angle === 'left_side' ? '左侧' :
                       photo.angle === 'right_side' ? '右侧' : '背面'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// 指标卡片
const MetricCard: React.FC<{
  label: string;
  value: number | null;
  description: string;
}> = ({ label, value, description }) => {
  const getColor = (v: number | null) => {
    if (!v) return 'bg-slate-100 text-slate-400';
    if (v >= 90) return 'bg-green-100 text-green-800';
    if (v >= 75) return 'bg-lime-100 text-lime-800';
    if (v >= 60) return 'bg-amber-100 text-amber-800';
    return 'bg-red-100 text-red-800';
  };

  return (
    <div className="bg-slate-50 rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-slate-600">{label}</span>
        <span className={`px-2 py-1 rounded-lg text-xs font-medium ${getColor(value)}`}>
          {value?.toFixed(1) || '-'}
        </span>
      </div>
      <div className="w-full bg-slate-200 rounded-full h-2 mb-2">
        <div
          className={`h-2 rounded-full ${
            !value ? 'bg-slate-400' :
            value >= 90 ? 'bg-green-500' :
            value >= 75 ? 'bg-lime-500' :
            value >= 60 ? 'bg-amber-500' : 'bg-red-500'
          }`}
          style={{ width: `${value || 0}%` }}
        />
      </div>
      <p className="text-xs text-slate-500">{description}</p>
    </div>
  );
};

export default PostureHistory;
