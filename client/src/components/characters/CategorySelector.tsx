import React, { useState } from 'react';
import { ChevronDown, Filter, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

// 多层次分类体系（从CharacterGrid移植）
interface CategoryGroup {
  key: string;
  label: string;
  categories: {
    key: string;
    label: string;
    keywords: string[];
  }[];
}

const categoryGroups: CategoryGroup[] = [
  {
    key: 'source',
    label: '来源分类',
    categories: [
      { key: 'anime', label: '动漫', keywords: ['动漫', 'anime', 'manga', '漫画', '二次元', '动画'] },
      { key: 'game', label: '游戏', keywords: ['游戏', 'game', 'gaming', '电竞', '虚拟'] },
      { key: 'movie', label: '影视', keywords: ['影视', 'movie', 'film', '电影', '电视剧', '明星'] },
      { key: 'book', label: '书籍', keywords: ['书籍', 'book', 'novel', '小说', '文学', '名著'] },
      { key: 'celebrity', label: '真人', keywords: ['真人', 'celebrity', '名人', '明星', '历史', 'historical'] },
      { key: 'life', label: '生活', keywords: ['生活', 'life', '日常', '现实', 'original', '原创'] }
    ]
  },
  {
    key: 'scene',
    label: '场景分类', 
    categories: [
      { key: 'family', label: '家庭', keywords: ['家庭', 'family', '亲情', '家人', '父母', '兄妹'] },
      { key: 'school', label: '校园', keywords: ['校园', 'school', '学生', '老师', '同学', '青春'] },
      { key: 'office', label: '职场', keywords: ['职场', 'office', '公司', '同事', '老板', '商务'] },
      { key: 'party', label: '聚会', keywords: ['聚会', 'party', '派对', '社交', '朋友', '娱乐'] },
      { key: 'travel', label: '旅行', keywords: ['旅行', 'travel', '冒险', '探索', '度假'] },
      { key: 'medical', label: '医院', keywords: ['医院', 'medical', '医生', '护士', '病人', '治疗'] },
      { key: 'restaurant', label: '餐厅', keywords: ['餐厅', 'restaurant', '服务员', '厨师', '美食'] }
    ]
  },
  {
    key: 'style',
    label: '风格分类',
    categories: [
      { key: 'fantasy', label: '奇幻', keywords: ['奇幻', 'fantasy', '魔法', '神话', '超自然', '魔幻'] },
      { key: 'scifi', label: '科幻', keywords: ['科幻', 'sci-fi', '未来', '机器人', '太空', 'android'] },
      { key: 'warm', label: '温情', keywords: ['温情', 'warm', '治愈', '暖心', '友好', '温柔体贴', '可爱'] },
      { key: 'historical', label: '古装', keywords: ['古装', 'historical', '古代', '传统', '历史', '武侠'] },
      { key: 'modern', label: '现代', keywords: ['现代', 'modern', '都市', '时尚', '当代'] },
      { key: 'horror', label: '恐怖', keywords: ['恐怖', 'horror', '惊悚', '悬疑', '黑暗'] },
      { key: 'humor', label: '幽默', keywords: ['幽默', 'humor', '搞笑', '诙谐', '轻松', '俏皮叛逆'] }
    ]
  }
];

// 扁平化所有分类用于快速查找
const allCategories = categoryGroups.flatMap(group => group.categories);

interface CategorySelectorProps {
  selectedCategories: string[];
  onCategoriesChange: (categories: string[]) => void;
  maxSelections?: number;
  className?: string;
}

export const CategorySelector: React.FC<CategorySelectorProps> = ({
  selectedCategories,
  onCategoriesChange,
  maxSelections = 5,
  className = ""
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  const handleToggleExpand = () => {
    if (isExpanded) {
      // 收起时先触发退出动画
      setIsAnimating(true);
      setTimeout(() => {
        setIsExpanded(false);
        setIsAnimating(false);
      }, 200); // 匹配动画持续时间
    } else {
      // 展开时直接显示
      setIsExpanded(true);
    }
  };

  const handleCategoryToggle = (categoryKey: string) => {
    if (selectedCategories.includes(categoryKey)) {
      // 移除已选择的分类
      onCategoriesChange(selectedCategories.filter(key => key !== categoryKey));
    } else {
      // 添加新分类（检查最大选择数量）
      if (selectedCategories.length < maxSelections) {
        onCategoriesChange([...selectedCategories, categoryKey]);
      }
    }
  };

  const handleRemoveCategory = (categoryKey: string) => {
    onCategoriesChange(selectedCategories.filter(key => key !== categoryKey));
  };

  const getSelectedCategoryLabel = (categoryKey: string) => {
    const category = allCategories.find(cat => cat.key === categoryKey);
    return category?.label || categoryKey;
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* 已选择的分类标签 */}
      {selectedCategories.length > 0 && (
        <div className="space-y-2">
          <label className="text-sm font-medium text-muted-foreground">
            已选择分类 ({selectedCategories.length}/{maxSelections})
          </label>
          <div className="flex flex-wrap gap-2">
            {selectedCategories.map(categoryKey => (
              <Badge
                key={categoryKey}
                variant="default"
                className="gap-1.5 bg-brand-accent text-white"
              >
                {getSelectedCategoryLabel(categoryKey)}
                <X
                  className="w-3 h-3 cursor-pointer hover:text-red-200"
                  onClick={() => handleRemoveCategory(categoryKey)}
                />
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* 分类选择区域 */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium">选择角色分类</label>
          <button
            type="button"
            onClick={handleToggleExpand}
            className="flex items-center space-x-1 px-3 py-1.5 rounded-full text-xs bg-surface-secondary text-content-secondary hover:bg-zinc-600 transition-all duration-200 active:scale-95"
          >
            <Filter className="w-3 h-3" />
            <span>{isExpanded ? '收起' : '展开分类'}</span>
            <ChevronDown className={`w-3 h-3 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {/* 常用分类（始终显示） */}
        <div className="space-y-2">
          <h4 className="text-xs font-medium text-content-tertiary uppercase tracking-wider">
            推荐分类
          </h4>
          <div className="flex flex-wrap gap-2">
            {allCategories.slice(0, 8).map(category => (
              <button
                key={category.key}
                type="button"
                onClick={() => handleCategoryToggle(category.key)}
                disabled={!selectedCategories.includes(category.key) && selectedCategories.length >= maxSelections}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-200 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed ${
                  selectedCategories.includes(category.key)
                    ? 'bg-brand-accent text-white shadow-surface scale-105'
                    : 'bg-surface-tertiary text-content-secondary hover:bg-zinc-600'
                }`}
              >
                {category.label}
              </button>
            ))}
          </div>
        </div>

        {/* 展开的分类标签 */}
        {isExpanded && (
          <div className={`space-y-3 p-4 bg-surface-secondary/30 rounded-lg border border-surface-border overflow-hidden ${isAnimating ? 'animate-slideUp' : 'animate-slideDown'}`}>
            {categoryGroups.map(group => (
              <div key={group.key} className="space-y-2">
                <h4 className="text-xs font-medium text-content-tertiary uppercase tracking-wider px-1">
                  {group.label}
                </h4>
                <div className="flex flex-wrap gap-2">
                  {group.categories.map(category => (
                    <button
                      key={category.key}
                      type="button"
                      onClick={() => {
                        handleCategoryToggle(category.key);
                        // 选择后不自动收起，让用户可以继续选择
                      }}
                      disabled={!selectedCategories.includes(category.key) && selectedCategories.length >= maxSelections}
                      className={`px-3 py-1 rounded-full text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                        selectedCategories.includes(category.key)
                          ? 'bg-brand-accent text-white shadow-surface'
                          : 'bg-surface-tertiary text-content-secondary hover:bg-zinc-600'
                      }`}
                    >
                      {category.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 提示信息 */}
        <p className="text-xs text-muted-foreground">
          最多可以选择 {maxSelections} 个分类，这将帮助其他用户更容易找到你的角色
        </p>
      </div>
    </div>
  );
};

export default CategorySelector;