
import React from 'react';
import { useAuth } from '../App';
import { User, Shield, IdCard, Mail, Edit3, Camera } from 'lucide-react';

const UserProfile: React.FC = () => {
  const { auth } = useAuth();
  
  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">个人资料</h1>
        <p className="text-slate-500">管理您的账户设置和学习偏好</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-1">
          <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm text-center">
             <div className="relative inline-block mb-6">
                <div className="w-32 h-32 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 text-4xl font-bold border-4 border-white shadow-lg">
                  {auth.user?.username.charAt(0).toUpperCase()}
                </div>
                <button className="absolute bottom-0 right-0 p-2 bg-indigo-600 text-white rounded-full border-2 border-white shadow-sm hover:bg-indigo-700 transition-all">
                  <Camera className="w-4 h-4" />
                </button>
             </div>
             <h3 className="text-xl font-bold text-slate-900">{auth.user?.username}</h3>
             <p className="text-sm text-slate-500 mt-1 capitalize">{auth.user?.role}</p>
             
             <div className="mt-8 pt-8 border-t border-slate-100 space-y-4">
                <div className="flex items-center justify-between text-sm">
                   <span className="text-slate-500">已学习动作</span>
                   <span className="font-bold text-slate-900">12</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                   <span className="text-slate-500">练习视频数</span>
                   <span className="font-bold text-slate-900">45</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                   <span className="text-slate-500">平均评分</span>
                   <span className="font-bold text-emerald-600">88.5</span>
                </div>
             </div>
          </div>
        </div>

        <div className="md:col-span-2 space-y-6">
           <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
              <div className="flex items-center justify-between mb-8">
                 <h3 className="text-lg font-bold text-slate-900">基本信息</h3>
                 <button className="flex items-center gap-2 text-indigo-600 text-sm font-bold hover:underline">
                    <Edit3 className="w-4 h-4" />
                    编辑资料
                 </button>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                 <InfoItem icon={<User className="w-5 h-5" />} label="用户名" value={auth.user?.username || '-'} />
                 <InfoItem icon={<IdCard className="w-5 h-5" />} label="用户 ID" value={auth.user?.id.toString() || '-'} />
                 <InfoItem icon={<Shield className="w-5 h-5" />} label="当前角色" value={auth.user?.role || '-'} />
                 <InfoItem icon={<Mail className="w-5 h-5" />} label="电子邮箱" value="user@aisports.com" />
              </div>
           </div>

           <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
              <h3 className="text-lg font-bold text-slate-900 mb-6">账户安全</h3>
              <div className="space-y-4">
                 <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <div>
                       <p className="font-semibold text-slate-900">修改登录密码</p>
                       <p className="text-xs text-slate-500 mt-0.5">定期更换密码以保护账户安全</p>
                    </div>
                    <button className="px-4 py-2 bg-white text-indigo-600 text-xs font-bold rounded-lg border border-slate-200 hover:bg-slate-50">立即修改</button>
                 </div>
                 <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <div>
                       <p className="font-semibold text-slate-900">双重身份认证</p>
                       <p className="text-xs text-slate-500 mt-0.5">目前尚未开启</p>
                    </div>
                    <button className="px-4 py-2 bg-white text-indigo-600 text-xs font-bold rounded-lg border border-slate-200 hover:bg-slate-50">开启</button>
                 </div>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};

const InfoItem = ({ icon, label, value }: { icon: React.ReactNode, label: string, value: string }) => (
  <div className="flex gap-4">
    <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400">
       {icon}
    </div>
    <div>
       <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">{label}</p>
       <p className="text-slate-900 font-bold mt-0.5">{value}</p>
    </div>
  </div>
);

export default UserProfile;
