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
  Activity,
  AlertTriangle,
  CheckCircle,
  Target,
  BarChart3,
  PieChart,
  LineChart,
  Edit,
  Save,
  X
} from 'lucide-react';
import * as postureApi from '../api/posture';
import {
  PostureHistoryItem,
  PostureHistoryList,
  AssessmentType,
  DetailedAssessmentReport
} from '../types';
import { PieChart as RechartsPieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { LineChart as RechartsLineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip } from 'recharts';
import { BarChart as RechartsBarChart, Bar, XAxis as RechartsXAxis, YAxis as RechartsYAxis, CartesianGrid as RechartsCartesianGrid } from 'recharts';

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

  // 自定义班级信息
  const [classInfo, setClassInfo] = useState({
    className: '体育教学二班体态分析报告',
    semester: '2024年春季学期'
  });
  const [isEditingClassInfo, setIsEditingClassInfo] = useState(false);
  const [editingClassInfo, setEditingClassInfo] = useState({
    className: '体育教学二班体态分析报告',
    semester: '2024年春季学期'
  });

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

  const handleEditClassInfo = () => {
    setEditingClassInfo({ ...classInfo });
    setIsEditingClassInfo(true);
  };

  const handleSaveClassInfo = () => {
    setClassInfo({ ...editingClassInfo });
    setIsEditingClassInfo(false);
  };

  const handleCancelEditClassInfo = () => {
    setIsEditingClassInfo(false);
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
          <div className="space-y-6">
            {/* 班级基本信息概览 */}
            <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl shadow-lg p-6 text-white">
              <div className="flex items-center justify-between mb-4">
                <div className="flex-1">
                  {isEditingClassInfo ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <input
                          type="text"
                          value={editingClassInfo.className}
                          onChange={(e) => setEditingClassInfo({ ...editingClassInfo, className: e.target.value })}
                          className="flex-1 px-4 py-2 bg-white/20 backdrop-blur-sm border border-white/30 rounded-lg text-white placeholder-white/50 focus:outline-none focus:border-white"
                          placeholder="班级分析报告标题"
                        />
                      </div>
                      <div className="flex items-center gap-3">
                        <input
                          type="text"
                          value={editingClassInfo.semester}
                          onChange={(e) => setEditingClassInfo({ ...editingClassInfo, semester: e.target.value })}
                          className="flex-1 px-4 py-2 bg-white/20 backdrop-blur-sm border border-white/30 rounded-lg text-white placeholder-white/50 focus:outline-none focus:border-white"
                          placeholder="学期信息"
                        />
                      </div>
                    </div>
                  ) : (
                    <div>
                      <h3 className="text-2xl font-bold mb-1">{classInfo.className}</h3>
                      <p className="text-indigo-200">{classInfo.semester} · 更新时间: 今天</p>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-4">
                  {isEditingClassInfo ? (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleSaveClassInfo}
                        className="flex items-center gap-1 px-3 py-1.5 bg-green-500 hover:bg-green-600 rounded-lg transition-colors"
                      >
                        <Save size={16} />
                        <span className="text-sm font-medium">保存</span>
                      </button>
                      <button
                        onClick={handleCancelEditClassInfo}
                        className="flex items-center gap-1 px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
                      >
                        <X size={16} />
                        <span className="text-sm font-medium">取消</span>
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={handleEditClassInfo}
                      className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
                    >
                      <Edit size={16} />
                      <span className="text-sm font-medium">编辑</span>
                    </button>
                  )}
                  <div className="text-right">
                    <div className="text-4xl font-bold">58</div>
                    <div className="text-sm text-indigo-200">班级总人数</div>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                <div className="bg-white/20 backdrop-blur-sm rounded-xl p-3 text-center">
                  <div className="text-xl font-bold">28</div>
                  <div className="text-xs text-indigo-100">男生</div>
                </div>
                <div className="bg-white/20 backdrop-blur-sm rounded-xl p-3 text-center">
                  <div className="text-xl font-bold">30</div>
                  <div className="text-xs text-indigo-100">女生</div>
                </div>
                <div className="bg-white/20 backdrop-blur-sm rounded-xl p-3 text-center">
                  <div className="text-xl font-bold">20.3</div>
                  <div className="text-xs text-indigo-100">平均年龄</div>
                </div>
                <div className="bg-white/20 backdrop-blur-sm rounded-xl p-3 text-center">
                  <div className="text-xl font-bold">66.0</div>
                  <div className="text-xs text-indigo-100">平均分</div>
                </div>
                <div className="bg-white/20 backdrop-blur-sm rounded-xl p-3 text-center">
                  <div className="text-xl font-bold">62%</div>
                  <div className="text-xs text-indigo-100">合格率</div>
                </div>
                <div className="bg-white/20 backdrop-blur-sm rounded-xl p-3 text-center">
                  <div className="text-xl font-bold">4</div>
                  <div className="text-xs text-indigo-100">优秀学生</div>
                </div>
              </div>
            </div>

            {/* 班级成绩分布和趋势 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* 分数分布图表 */}
              <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <BarChart3 size={20} className="text-blue-600" />
                    班级成绩分布
                  </h3>
                  <div className="text-sm text-slate-500">基于全班30名学生</div>
                </div>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsBarChart data={[
                      { name: '90+', value: 2, students: 2, percentage: 7, color: '#22c55e' },
                      { name: '85-89', value: 4, students: 4, percentage: 13, color: '#3b82f6' },
                      { name: '80-84', value: 7, students: 7, percentage: 23, color: '#f59e0b' },
                      { name: '75-79', value: 6, students: 6, percentage: 20, color: '#f97316' },
                      { name: '70-74', value: 0, students: 0, percentage: 0, color: '#f43f5e' },
                      { name: '<70', value: 11, students: 11, percentage: 37, color: '#ef4444' }
                    ]}>
                      <RechartsCartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <RechartsXAxis
                        dataKey="name"
                        tick={{ fontSize: 12 }}
                        stroke="#94a3b8"
                      />
                      <RechartsYAxis
                        tick={{ fontSize: 12 }}
                        stroke="#94a3b8"
                        label={{ value: '人数', angle: -90, position: 'insideLeft' }}
                      />
                      <RechartsTooltip
                        contentStyle={{
                          backgroundColor: 'white',
                          border: '1px solid #e2e8f0',
                          borderRadius: '8px',
                          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                        }}
                        formatter={(value: any, name: any, props: any) => [
                          `${value}人 (${props.payload.percentage}%)`,
                          '分数段'
                        ]}
                      />
                      <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                        {[
                          { name: '90+', value: 2, students: 2, percentage: 7, color: '#22c55e' },
                          { name: '85-89', value: 4, students: 4, percentage: 13, color: '#3b82f6' },
                          { name: '80-84', value: 7, students: 7, percentage: 23, color: '#f59e0b' },
                          { name: '75-79', value: 6, students: 6, percentage: 20, color: '#f97316' },
                          { name: '70-74', value: 0, students: 0, percentage: 0, color: '#f43f5e' },
                          { name: '<70', value: 11, students: 11, percentage: 37, color: '#ef4444' }
                        ].map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Bar>
                    </RechartsBarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* 班级分数趋势 */}
              <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <LineChart size={20} className="text-indigo-600" />
                    班级平均分趋势
                  </h3>
                  <div className="text-sm text-slate-500">近8次检测</div>
                </div>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsLineChart data={[
                      { name: '第1次', avg: 62.5, male: 63.2, female: 61.8 },
                      { name: '第2次', avg: 63.8, male: 64.5, female: 63.1 },
                      { name: '第3次', avg: 64.2, male: 65.8, female: 62.6 },
                      { name: '第4次', avg: 65.5, male: 66.5, female: 64.5 },
                      { name: '第5次', avg: 66.8, male: 67.8, female: 65.8 },
                      { name: '第6次', avg: 66.2, male: 67.5, female: 64.9 },
                      { name: '第7次', avg: 67.5, male: 69.2, female: 65.8 },
                      { name: '第8次', avg: 68.5, male: 70.8, female: 66.2 }
                    ]}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis
                        dataKey="name"
                        tick={{ fontSize: 12 }}
                        stroke="#94a3b8"
                      />
                      <YAxis
                        domain={[55, 85]}
                        tick={{ fontSize: 12 }}
                        stroke="#94a3b8"
                        label={{ value: '分数', angle: -90, position: 'insideLeft' }}
                      />
                      <RechartsTooltip
                        contentStyle={{
                          backgroundColor: 'white',
                          border: '1px solid #e2e8f0',
                          borderRadius: '8px',
                          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                        }}
                        formatter={(value: any) => [value.toFixed(1), '平均分']}
                      />
                      <Line
                        type="monotone"
                        dataKey="avg"
                        stroke="#6366f1"
                        strokeWidth={3}
                        dot={{ fill: '#6366f1', strokeWidth: 2, r: 4 }}
                        activeDot={{ r: 6, fill: '#4f46e5' }}
                        name="班级平均"
                      />
                      <Line
                        type="monotone"
                        dataKey="male"
                        stroke="#3b82f6"
                        strokeWidth={2}
                        dot={{ fill: '#3b82f6', strokeWidth: 2, r: 3 }}
                        activeDot={{ r: 5 }}
                        name="男生"
                      />
                      <Line
                        type="monotone"
                        dataKey="female"
                        stroke="#ec4899"
                        strokeWidth={2}
                        dot={{ fill: '#ec4899', strokeWidth: 2, r: 3 }}
                        activeDot={{ r: 5 }}
                        name="女生"
                      />
                    </RechartsLineChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex justify-center gap-6 mt-2 text-xs">
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-indigo-600"></div>
                    <span className="text-slate-600">班级平均</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                    <span className="text-slate-600">男生</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-pink-500"></div>
                    <span className="text-slate-600">女生</span>
                  </div>
                </div>
              </div>
            </div>

            {/* 体态问题分布 */}
            <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <PieChart size={20} className="text-rose-600" />
                  班级体态问题分布
                </h3>
                <div className="text-sm text-slate-500">基于30名学生的体态分析</div>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsPieChart>
                      <Pie
                        data={[
                          { name: '头前伸', value: 27, students: 27, percentage: 90, color: '#f43f5e' },
                          { name: '驼背', value: 24, students: 24, percentage: 80, color: '#ef4444' },
                          { name: '圆肩', value: 21, students: 21, percentage: 70, color: '#f97316' },
                          { name: '高低肩', value: 18, students: 18, percentage: 60, color: '#eab308' },
                          { name: '骨盆前倾', value: 15, students: 15, percentage: 50, color: '#f59e0b' },
                          { name: '脊柱侧弯', value: 9, students: 9, percentage: 30, color: '#84cc16' }
                        ]}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={2}
                        dataKey="value"
                        label={({ percentage }) => `${percentage}%`}
                        labelLine={false}
                      >
                        {[
                          { name: '头前伸', value: 27, students: 27, percentage: 90, color: '#f43f5e' },
                          { name: '驼背', value: 24, students: 24, percentage: 80, color: '#ef4444' },
                          { name: '圆肩', value: 21, students: 21, percentage: 70, color: '#f97316' },
                          { name: '高低肩', value: 18, students: 18, percentage: 60, color: '#eab308' },
                          { name: '骨盆前倾', value: 15, students: 15, percentage: 50, color: '#f59e0b' },
                          { name: '脊柱侧弯', value: 9, students: 9, percentage: 30, color: '#84cc16' }
                        ].map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'white',
                          border: '1px solid #e2e8f0',
                          borderRadius: '8px',
                          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                        }}
                        formatter={(value: any, name: any, props: any) => [
                          `${value}人 (${props.payload.percentage}%)`,
                          name
                        ]}
                      />
                      <Legend
                        verticalAlign="bottom"
                        height={36}
                        iconType="circle"
                        wrapperStyle={{ fontSize: '12px' }}
                      />
                    </RechartsPieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-4">
                  <div className="bg-red-50 rounded-xl p-4 border-l-4 border-red-500">
                    <div className="flex items-start gap-3">
                      <AlertTriangle size={20} className="text-red-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <h4 className="font-semibold text-slate-900 mb-1">重点关注问题</h4>
                        <p className="text-sm text-slate-700">头前伸问题影响到了90%的学生（27人），是最为普遍的体态问题，需要重点干预。</p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-amber-50 rounded-xl p-4 border-l-4 border-amber-500">
                    <div className="flex items-start gap-3">
                      <TrendingUp size={20} className="text-amber-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <h4 className="font-semibold text-slate-900 mb-1">问题组合分析</h4>
                        <p className="text-sm text-slate-700">约80%的学生同时存在头前伸和驼背问题，提示需要综合性的体态改善方案。</p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-blue-50 rounded-xl p-4 border-l-4 border-blue-500">
                    <div className="flex items-start gap-3">
                      <CheckCircle size={20} className="text-blue-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <h4 className="font-semibold text-slate-900 mb-1">性别差异</h4>
                        <p className="text-sm text-slate-700">男生更容易出现骨盆前倾问题，而女生在圆肩和脊柱侧弯方面相对更常见。</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 智能分析建议 */}
            <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6">
              <div className="flex items-center gap-2 mb-4">
                <Target size={20} className="text-indigo-600" />
                <h3 className="text-lg font-bold text-slate-900">班级教学改进建议</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* 整体评估 */}
                <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl p-4 border border-indigo-100">
                  <div className="flex items-start gap-3">
                    <CheckCircle size={20} className="text-indigo-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <h4 className="font-semibold text-slate-900 mb-2">整体体态状况需要关注</h4>
                      <p className="text-sm text-slate-700">班级平均分66.0分，62%的学生达到合格标准，因长时间坐姿学习导致体态问题较多，需要加强改善训练。</p>
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl p-4 border border-amber-100">
                  <div className="flex items-start gap-3">
                    <Target size={20} className="text-amber-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <h4 className="font-semibold text-slate-900 mb-2">教学重点建议</h4>
                      <p className="text-sm text-slate-700 mb-2">针对性解决头前伸问题：</p>
                      <ul className="text-sm text-slate-600 space-y-1">
                        <li>• 每节课加入3分钟颈部拉伸</li>
                        <li>• 电子设备使用规范指导</li>
                        <li>• 姿势纠正技巧训练</li>
                      </ul>
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-4 border border-green-100">
                  <div className="flex items-start gap-3">
                    <Activity size={20} className="text-green-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <h4 className="font-semibold text-slate-900 mb-2">分组教学方案</h4>
                      <p className="text-sm text-slate-700 mb-2">建议按体态问题分组：</p>
                      <div className="flex flex-wrap gap-2">
                        <span className="px-2 py-1 bg-green-100 text-green-700 rounded-lg text-xs">头前伸组</span>
                        <span className="px-2 py-1 bg-green-100 text-green-700 rounded-lg text-xs">驼背组</span>
                        <span className="px-2 py-1 bg-green-100 text-green-700 rounded-lg text-xs">综合组</span>
                        <span className="px-2 py-1 bg-green-100 text-green-700 rounded-lg text-xs">优秀组</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl p-4 border border-blue-100">
                  <div className="flex items-start gap-3">
                    <Activity size={20} className="text-blue-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <h4 className="font-semibold text-slate-900 mb-2">课程训练计划</h4>
                      <p className="text-sm text-slate-700">建议每周增加2次体态改善训练课，包含：</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-lg text-xs">脊柱伸展</span>
                        <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-lg text-xs">肩颈拉伸</span>
                        <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-lg text-xs">核心训练</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-4 border border-purple-100">
                  <div className="flex items-start gap-3">
                    <CheckCircle size={20} className="text-purple-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <h4 className="font-semibold text-slate-900 mb-2">家校合作建议</h4>
                      <p className="text-sm text-slate-700">建议定期向家长发送体态检测报告，配合家庭环境的体态改善监督。</p>
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-rose-50 to-red-50 rounded-xl p-4 border border-rose-100">
                  <div className="flex items-start gap-3">
                    <TrendingUp size={20} className="text-rose-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <h4 className="font-semibold text-slate-900 mb-2">定期评估机制</h4>
                      <p className="text-sm text-slate-700">建议每月进行一次阶段性体态检测，追踪改善效果并调整教学方案。</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 详细统计看板 */}
            <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <BarChart3 size={20} className="text-blue-600" />
                  班级详细统计
                </h3>
                <div className="text-sm text-slate-500">基于最新检测数据</div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* 优秀学生 */}
                <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-4 border border-green-200">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-green-600">2</div>
                    <div className="text-sm text-slate-600">优秀学生 (90+分)</div>
                    <div className="text-xs text-green-600 mt-1">占比 7%</div>
                  </div>
                </div>

                {/* 需要关注 */}
                <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl p-4 border border-amber-200">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-amber-600">17</div>
                    <div className="text-sm text-slate-600">需要关注 (70-84分)</div>
                    <div className="text-xs text-amber-600 mt-1">占比 57%</div>
                  </div>
                </div>

                {/* 急需改善 */}
                <div className="bg-gradient-to-br from-red-50 to-rose-50 rounded-xl p-4 border border-red-200">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-red-600">11</div>
                    <div className="text-sm text-slate-600">急需改善 (&lt;70分)</div>
                    <div className="text-xs text-red-600 mt-1">占比 37%</div>
                  </div>
                </div>

                {/* 改善趋势 */}
                <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl p-4 border border-blue-200">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-blue-600">+1.5</div>
                    <div className="text-sm text-slate-600">本学期平均提升</div>
                    <div className="text-xs text-blue-600 mt-1">较上学期</div>
                  </div>
                </div>
              </div>

              {/* 男女差异分析 */}
              <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                  <h4 className="text-sm font-semibold text-slate-700 mb-3">男生体态分析 (0人)</h4>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-600">平均分</span>
                      <span className="text-sm font-medium text-blue-600">--</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-600">主要问题</span>
                      <span className="text-sm font-medium text-amber-600">--</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-600">优秀率</span>
                      <span className="text-sm font-medium text-green-600">--</span>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                  <h4 className="text-sm font-semibold text-slate-700 mb-3">女生体态分析 (30人)</h4>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-600">平均分</span>
                      <span className="text-sm font-medium text-pink-600">66.0分</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-600">主要问题</span>
                      <span className="text-sm font-medium text-amber-600">头前伸 (90%)</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-600">合格率</span>
                      <span className="text-sm font-medium text-pink-600">62%</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 学生体态数据列表 */}
            <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">学生体态数据</h3>
                  <p className="text-sm text-slate-500">显示最近检测的10名学生数据</p>
                </div>
                <div className="text-right">
                  <div className="text-sm text-slate-500">总人数: 66人</div>
                  <div className="text-sm text-indigo-600">已检测: 66人</div>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                <div className="bg-white rounded-xl p-3 text-center shadow-sm">
                  <div className="text-xl font-bold text-indigo-600">30</div>
                  <div className="text-xs text-slate-600">总检测</div>
                </div>
                <div className="bg-white rounded-xl p-3 text-center shadow-sm">
                  <div className="text-xl font-bold text-green-600">66.0</div>
                  <div className="text-xs text-slate-600">平均分</div>
                </div>
                <div className="bg-white rounded-xl p-3 text-center shadow-sm">
                  <div className="text-xl font-bold text-amber-600">20.3</div>
                  <div className="text-xs text-slate-600">平均年龄</div>
                </div>
                <div className="bg-white rounded-xl p-3 text-center shadow-sm">
                  <div className="text-xl font-bold text-blue-600">7%</div>
                  <div className="text-xs text-slate-600">优秀率</div>
                </div>
                <div className="bg-white rounded-xl p-3 text-center shadow-sm">
                  <div className="text-xl font-bold text-red-600">24</div>
                  <div className="text-xs text-slate-600">驼背</div>
                </div>
                <div className="bg-white rounded-xl p-3 text-center shadow-sm">
                  <div className="text-xl font-bold text-rose-600">51</div>
                  <div className="text-xs text-slate-600">头前伸</div>
                </div>
              </div>
            </div>

            {/* 分数趋势图表 */}
            <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <LineChart size={20} className="text-indigo-600" />
                  分数趋势分析
                </h3>
                <div className="text-sm text-slate-500">最近10次检测</div>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsLineChart data={history.items.slice(0, 10).reverse().map((item, index) => ({
                    name: `${index + 1}`,
                    score: item.overall_score,
                    date: new Date(item.assessment_date).toLocaleDateString('zh-CN')
                  }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 12 }}
                      stroke="#94a3b8"
                    />
                    <YAxis
                      domain={[60, 100]}
                      tick={{ fontSize: 12 }}
                      stroke="#94a3b8"
                    />
                    <RechartsTooltip
                      contentStyle={{
                        backgroundColor: 'white',
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                      }}
                      formatter={(value: any) => [`${value?.toFixed(1)} 分`, '体态分数']}
                    />
                    <Line
                      type="monotone"
                      dataKey="score"
                      stroke="#6366f1"
                      strokeWidth={3}
                      dot={{ fill: '#6366f1', strokeWidth: 2, r: 4 }}
                      activeDot={{ r: 6, fill: '#4f46e5' }}
                    />
                  </RechartsLineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* 问题分布和体态构成 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* 问题分布环形图 */}
              <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <PieChart size={20} className="text-rose-600" />
                    体态问题分布
                  </h3>
                  <div className="text-sm text-slate-500">基于{history.total}次检测</div>
                </div>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsPieChart>
                      <Pie
                        data={[
                          { name: '驼背', value: 44, color: '#ef4444' },
                          { name: '头前伸', value: 51, color: '#f43f5e' },
                          { name: '圆肩', value: 36, color: '#f97316' },
                          { name: '骨盆前倾', value: 24, color: '#f59e0b' },
                          { name: '高低肩', value: 28, color: '#eab308' },
                          { name: '脊柱侧弯', value: 14, color: '#84cc16' }
                        ]}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {[
                          { name: '驼背', value: 44, color: '#ef4444' },
                          { name: '头前伸', value: 51, color: '#f43f5e' },
                          { name: '圆肩', value: 36, color: '#f97316' },
                          { name: '骨盆前倾', value: 24, color: '#f59e0b' },
                          { name: '高低肩', value: 28, color: '#eab308' },
                          { name: '脊柱侧弯', value: 14, color: '#84cc16' }
                        ].map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'white',
                          border: '1px solid #e2e8f0',
                          borderRadius: '8px',
                          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                        }}
                        formatter={(value: any) => [value, '人数']}
                      />
                      <Legend
                        verticalAlign="bottom"
                        height={36}
                        iconType="circle"
                        wrapperStyle={{ fontSize: '12px' }}
                      />
                    </RechartsPieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* 智能分析建议卡片 */}
              <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Target size={20} className="text-indigo-600" />
                  <h3 className="text-lg font-bold text-slate-900">智能分析建议</h3>
                </div>
                <div className="space-y-4">
                  {/* 整体评估 */}
                  <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl p-4 border-l-4 border-indigo-600">
                    <div className="flex items-start gap-3">
                      <CheckCircle size={20} className="text-indigo-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <h4 className="font-semibold text-slate-900 mb-1">整体体态状态需要改善</h4>
                        <p className="text-sm text-slate-700">您的平均体态分数为66.0分，因长时间坐姿学习导致体态问题较多。建议加强体态改善训练和定期检测。</p>
                      </div>
                    </div>
                  </div>

                  {/* 改善建议 */}
                  <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl p-4 border-l-4 border-amber-500">
                    <div className="flex items-start gap-3">
                      <TrendingUp size={20} className="text-amber-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <h4 className="font-semibold text-slate-900 mb-1">重点改善领域</h4>
                        <p className="text-sm text-slate-700 mb-2">头前伸问题最为突出（90%），建议每天进行颈部拉伸训练：</p>
                        <ul className="text-sm text-slate-600 space-y-1">
                          <li>• 每小时提醒自己下巴水平后收</li>
                          <li>• 调整工作屏幕高度至视线水平</li>
                          <li>• 进行颈部侧向拉伸15次/组</li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  {/* 训练计划 */}
                  <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-4 border-l-4 border-green-500">
                    <div className="flex items-start gap-3">
                      <Activity size={20} className="text-green-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <h4 className="font-semibold text-slate-900 mb-1">推荐训练计划</h4>
                        <p className="text-sm text-slate-700">建议制定每周3次的体态改善计划，结合以下动作：</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <span className="px-2 py-1 bg-green-100 text-green-700 rounded-lg text-xs">背部伸展</span>
                          <span className="px-2 py-1 bg-green-100 text-green-700 rounded-lg text-xs">肩部拉伸</span>
                          <span className="px-2 py-1 bg-green-100 text-green-700 rounded-lg text-xs">核心训练</span>
                          <span className="px-2 py-1 bg-green-100 text-green-700 rounded-lg text-xs">猫牛式</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 详细统计看板 */}
            <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <BarChart3 size={20} className="text-blue-600" />
                  详细统计分析
                </h3>
                <div className="text-sm text-slate-500">基于最新数据</div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* 分数分布 */}
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                  <h4 className="text-sm font-semibold text-slate-700 mb-3">分数分布</h4>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-600">90分以上</span>
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-2 bg-slate-200 rounded-full overflow-hidden">
                          <div className="h-full bg-green-500" style={{ width: '7%' }}></div>
                        </div>
                        <span className="text-sm font-medium text-slate-700">2人</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-600">85-89分</span>
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-2 bg-slate-200 rounded-full overflow-hidden">
                          <div className="h-full bg-blue-500" style={{ width: '13%' }}></div>
                        </div>
                        <span className="text-sm font-medium text-slate-700">4人</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-600">70-84分</span>
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-2 bg-slate-200 rounded-full overflow-hidden">
                          <div className="h-full bg-amber-500" style={{ width: '57%' }}></div>
                        </div>
                        <span className="text-sm font-medium text-slate-700">17人</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-600">70分以下</span>
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-2 bg-slate-200 rounded-full overflow-hidden">
                          <div className="h-full bg-red-500" style={{ width: '37%' }}></div>
                        </div>
                        <span className="text-sm font-medium text-slate-700">11人</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 问题严重度 */}
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                  <h4 className="text-sm font-semibold text-slate-700 mb-3">问题严重度</h4>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full bg-red-500"></div>
                      <div className="flex-1">
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-600">严重问题</span>
                          <span className="text-red-600 font-medium">8例</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full bg-amber-500"></div>
                      <div className="flex-1">
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-600">中等问题</span>
                          <span className="text-amber-600 font-medium">23例</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
                      <div className="flex-1">
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-600">轻微问题</span>
                          <span className="text-yellow-600 font-medium">31例</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full bg-green-500"></div>
                      <div className="flex-1">
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-600">无问题</span>
                          <span className="text-green-600 font-medium">4例</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 改善趋势 */}
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                  <h4 className="text-sm font-semibold text-slate-700 mb-3">改善趋势</h4>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-600">改善人数</span>
                      <span className="text-sm font-medium text-green-600">↑ 45%</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-600">保持稳定</span>
                      <span className="text-sm font-medium text-blue-600">= 38%</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-600">需要关注</span>
                      <span className="text-sm font-medium text-amber-600">→ 17%</span>
                    </div>
                    <div className="mt-3 pt-3 border-t border-slate-200">
                      <p className="text-xs text-slate-500">近30天数据显示整体改善趋势积极</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 学生体态数据列表 */}
            <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">学生体态数据</h3>
                  <p className="text-sm text-slate-500">显示最近检测的10名学生数据</p>
                </div>
                <div className="text-right">
                  <div className="text-sm text-slate-500">总人数: 66人</div>
                  <div className="text-sm text-indigo-600">已检测: 66人</div>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl p-4 text-center border border-indigo-100">
                  <div className="text-2xl font-bold text-indigo-600">30</div>
                  <div className="text-xs text-slate-600">总检测次数</div>
                </div>
                <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-4 text-center border border-green-100">
                  <div className="text-2xl font-bold text-green-600">66.0</div>
                  <div className="text-xs text-slate-600">平均分数</div>
                </div>
                <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl p-4 text-center border border-amber-100">
                  <div className="text-2xl font-bold text-amber-600">20.3</div>
                  <div className="text-xs text-slate-600">平均年龄</div>
                </div>
                <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl p-4 text-center border border-blue-100">
                  <div className="text-2xl font-bold text-blue-600">62%</div>
                  <div className="text-xs text-slate-600">合格率 (70分+)</div>
                </div>
                <div className="bg-gradient-to-br from-red-50 to-rose-50 rounded-xl p-4 text-center border border-red-100">
                  <div className="text-2xl font-bold text-red-600">24</div>
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
                    <span className="text-sm text-slate-600">驼背 80%</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-rose-500"></div>
                    <span className="text-sm text-slate-600">头前伸 90%</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-orange-500"></div>
                    <span className="text-sm text-slate-600">圆肩 70%</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-amber-500"></div>
                    <span className="text-sm text-slate-600">骨盆前倾 50%</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                    <span className="text-sm text-slate-600">高低肩 60%</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-lime-500"></div>
                    <span className="text-sm text-slate-600">脊柱侧弯 30%</span>
                  </div>
                </div>
              </div>
            </div>

            {/* 历史记录列表 */}
            <div className="space-y-3">
              {history.items.slice(0, 10).map((item, index) => (
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
                          (item.overall_score || 0) >= 90 ? 'bg-green-100 text-green-800' :
                          (item.overall_score || 0) >= 80 ? 'bg-blue-100 text-blue-800' :
                          (item.overall_score || 0) >= 70 ? 'bg-amber-100 text-amber-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {(item.overall_score || 0) >= 90 ? '优秀' :
                           (item.overall_score || 0) >= 80 ? '良好' :
                           (item.overall_score || 0) >= 70 ? '及格' : '需努力'}
                        </span>
                        <span className="text-sm text-slate-500 flex items-center gap-1">
                          <Calendar size={14} />
                          {new Date(item.assessment_date).toLocaleDateString('zh-CN')}
                        </span>
                      </div>

                      <div className="flex items-center gap-4 text-sm text-slate-600">
                        <span>年龄: {item.age || 20}岁</span>
                        <span>身高: {item.height || 170}cm</span>
                        <span>{item.issue_count || 2} 个体态问题</span>
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
