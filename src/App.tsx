/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Upload, 
  Camera, 
  Sparkles, 
  Palette, 
  Megaphone, 
  CheckCircle2, 
  Loader2, 
  ChevronRight,
  Image as ImageIcon,
  ArrowRight,
  RefreshCcw,
  Sun,
  Moon
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { analyzeScene, suggestDesign, generateMarketing, generateProductImage, type SceneAnalysis, type DesignTheme, type MarketingCopy } from './services/gemini';

type Step = 'idle' | 'analyzing' | 'designing' | 'generating_image' | 'marketing' | 'completed';

export default function App() {
  const [image, setImage] = useState<string | null>(null);
  const [step, setStep] = useState<Step>('idle');
  const [progress, setProgress] = useState(0);
  
  const [analysis, setAnalysis] = useState<SceneAnalysis | null>(null);
  const [themes, setThemes] = useState<DesignTheme[]>([]);
  const [selectedTheme, setSelectedTheme] = useState<DesignTheme | null>(null);
  const [marketing, setMarketing] = useState<MarketingCopy | null>(null);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(true);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.jpeg', '.jpg', '.png', '.webp'] },
    multiple: false,
    disabled: step !== 'idle'
  } as any);

  const runEngine = async () => {
    if (!image) return;

    try {
      // Step 1: Agent A - Scene Analyzer
      setStep('analyzing');
      setProgress(20);
      const base64 = image.split(',')[1];
      const analysisResult = await analyzeScene(base64);
      setAnalysis(analysisResult);
      setProgress(40);

      // Step 2: Agent B - Designer
      setStep('designing');
      setProgress(60);
      const designThemes = await suggestDesign(analysisResult);
      setThemes(designThemes);
      const defaultTheme = designThemes[0];
      setSelectedTheme(defaultTheme);
      setProgress(80);

      // Step 3: Agent D - Visual Generator
      setStep('generating_image');
      setProgress(75);
      const productImg = await generateProductImage(base64, analysisResult, defaultTheme);
      setGeneratedImage(productImg);
      setProgress(90);

      // Step 4: Agent C - Marketing
      setStep('marketing');
      const marketingCopy = await generateMarketing(analysisResult, defaultTheme);
      setMarketing(marketingCopy);
      setProgress(100);

      setStep('completed');
    } catch (error) {
      console.error('Engine error:', error);
      setStep('idle');
      setProgress(0);
    }
  };

  const reset = () => {
    setImage(null);
    setStep('idle');
    setProgress(0);
    setAnalysis(null);
    setThemes([]);
    setSelectedTheme(null);
    setMarketing(null);
    setGeneratedImage(null);
  };

  const handleThemeChange = async (theme: DesignTheme) => {
    if (!analysis || !image) return;
    try {
      setSelectedTheme(theme);
      setStep('generating_image');
      setProgress(50);
      const base64 = image.split(',')[1];
      const productImg = await generateProductImage(base64, analysis, theme);
      setGeneratedImage(productImg);
      setProgress(75);
      setStep('marketing');
      const marketingCopy = await generateMarketing(analysis, theme);
      setMarketing(marketingCopy);
      setProgress(100);
      setStep('completed');
    } catch (error) {
      console.error('Theme switch error:', error);
      // Gracefully fallback to design step if image generation fails
      setStep('completed');
      setGeneratedImage(null);
      setProgress(100);
      alert(`生成失败: ${error instanceof Error ? error.message : JSON.stringify(error)}`);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground font-sans selection:bg-primary/30 transition-colors duration-300">
      {/* Header */}
      <header className="border-b border-border/50 bg-background/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-primary flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-primary-foreground" />
            </div>
            <h1 className="text-base sm:text-lg font-semibold tracking-tight truncate">AI 电商视觉引擎</h1>
          </div>
          <div className="flex items-center gap-1 sm:gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="rounded-full w-8 h-8 sm:w-10 sm:h-10"
            >
              {isDarkMode ? <Sun className="w-4 h-4 sm:w-5 sm:h-5" /> : <Moon className="w-4 h-4 sm:w-5 sm:h-5" />}
            </Button>
            {step === 'completed' && (
              <Button variant="ghost" size="sm" onClick={reset} className="text-muted-foreground hover:text-foreground px-2 sm:px-3">
                <RefreshCcw className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">重置</span>
              </Button>
            )}
            <Badge variant="outline" className="border-border text-muted-foreground hidden sm:inline-flex">
              v1.0 Beta
            </Badge>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-12">
        <div className="grid lg:grid-cols-12 gap-8 lg:gap-12">
          
          {/* Left Column: Input & Progress */}
          <div className="lg:col-span-5 space-y-6 sm:space-y-8">
            <section className="space-y-3 sm:space-y-4">
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tighter">
                将随手拍的照片转化为 <span className="text-primary">高端资产</span>
              </h2>
              <p className="text-muted-foreground text-base sm:text-lg leading-relaxed">
                上传一张原始产品照片。我们的多智能体引擎将在几秒钟内完成分析、审美设计和爆款营销文案。
              </p>
            </section>

            <Card className="bg-card border-border overflow-hidden">
              <CardContent className="p-0">
                {!image ? (
                  <div 
                    {...getRootProps()} 
                    className={`aspect-square flex flex-col items-center justify-center p-6 sm:p-12 border-2 border-dashed transition-all cursor-pointer text-center
                      ${isDragActive ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-accent/30'}`}
                  >
                    <input {...getInputProps()} />
                    <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-muted flex items-center justify-center mb-4 sm:mb-6">
                      <Upload className="w-6 h-6 sm:w-8 sm:h-8 text-muted-foreground" />
                    </div>
                    <p className="text-base sm:text-lg font-medium mb-2">将产品照片拖放到此处</p>
                    <p className="text-muted-foreground text-xs sm:text-sm">支持 JPG, PNG，最大 10MB</p>
                  </div>
                ) : (
                  <div className="relative aspect-square group">
                    <img 
                      src={image} 
                      alt="产品" 
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                    {step === 'idle' && (
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Button variant="secondary" onClick={() => setImage(null)}>
                          更换照片
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {image && step === 'idle' && (
              <Button 
                onClick={runEngine} 
                className="w-full h-14 text-lg font-semibold shadow-lg shadow-primary/20"
              >
                启动 AI 引擎
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            )}

            {step !== 'idle' && step !== 'completed' && (
              <div className="space-y-4 sm:space-y-6 p-4 sm:p-6 bg-card border border-border rounded-xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-muted">
                  <motion.div 
                    className="h-full bg-primary"
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                  />
                </div>
                
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 text-primary animate-spin" />
                    <span className="text-sm font-bold text-foreground uppercase tracking-widest">
                      {step === 'analyzing' && '智能体 A: 场景分析师'}
                      {step === 'designing' && '智能体 B: 审美设计师'}
                      {step === 'generating_image' && '智能体 D: 视觉生成师'}
                      {step === 'marketing' && '智能体 C: 营销策划师'}
                    </span>
                  </div>
                  <span className="text-sm font-bold text-primary">{progress}%</span>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-3 text-xs">
                    <div className={`w-2 h-2 rounded-full ${step === 'analyzing' ? 'bg-primary animate-pulse' : 'bg-muted'}`} />
                    <span className={step === 'analyzing' ? 'text-foreground' : 'text-muted-foreground'}>正在提取产品特征和品类...</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <div className={`w-2 h-2 rounded-full ${step === 'designing' ? 'bg-primary animate-pulse' : 'bg-muted'}`} />
                    <span className={step === 'designing' ? 'text-foreground' : 'text-muted-foreground'}>正在匹配高端审美场景...</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <div className={`w-2 h-2 rounded-full ${step === 'generating_image' ? 'bg-primary animate-pulse' : 'bg-muted'}`} />
                    <span className={step === 'generating_image' ? 'text-foreground' : 'text-muted-foreground'}>正在生成爆款电商产品图...</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <div className={`w-2 h-2 rounded-full ${step === 'marketing' ? 'bg-primary animate-pulse' : 'bg-muted'}`} />
                    <span className={step === 'marketing' ? 'text-foreground' : 'text-muted-foreground'}>正在生成爆款营销文案...</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Results */}
          <div className="lg:col-span-7">
            <AnimatePresence mode="wait">
              {step === 'completed' ? (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="space-y-8"
                >
                  <Tabs defaultValue="marketing" className="w-full">
                    <TabsList className="flex w-full overflow-x-auto sm:grid sm:grid-cols-4 bg-muted border border-border p-1 h-auto min-h-12 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] justify-start sm:justify-center">
                      <TabsTrigger value="analysis" className="whitespace-nowrap flex-1 text-xs sm:text-sm py-2 px-3 sm:px-4 data-[state=active]:bg-background">分析报告</TabsTrigger>
                      <TabsTrigger value="design" className="whitespace-nowrap flex-1 text-xs sm:text-sm py-2 px-3 sm:px-4 data-[state=active]:bg-background">设计方案</TabsTrigger>
                      <TabsTrigger value="visual" className="whitespace-nowrap flex-1 text-xs sm:text-sm py-2 px-3 sm:px-4 data-[state=active]:bg-background">视觉生成</TabsTrigger>
                      <TabsTrigger value="marketing" className="whitespace-nowrap flex-1 text-xs sm:text-sm py-2 px-3 sm:px-4 data-[state=active]:bg-background">营销文案</TabsTrigger>
                    </TabsList>

                    <TabsContent value="visual" className="mt-6 space-y-6">
                      <Card className="bg-card border-border overflow-hidden">
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2">
                            <Sparkles className="w-5 h-5 text-primary" />
                            AI 生成产品图
                          </CardTitle>
                          <CardDescription>基于选定主题生成的专业电商主图</CardDescription>
                        </CardHeader>
                        <CardContent className="p-0">
                          {generatedImage ? (
                            <div className="relative aspect-square">
                              <img 
                                src={generatedImage} 
                                alt="Generated Product" 
                                className="w-full h-full object-cover"
                                referrerPolicy="no-referrer"
                              />
                              <div className="absolute bottom-4 right-4 flex gap-2">
                                <Button 
                                  size="sm" 
                                  variant="secondary"
                                  onClick={() => {
                                    const link = document.createElement('a');
                                    link.href = generatedImage;
                                    link.download = `product-${selectedTheme?.name || 'ai'}.png`;
                                    link.click();
                                  }}
                                >
                                  下载图片
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div className="aspect-square flex flex-col items-center justify-center p-12 text-muted-foreground">
                              <Loader2 className="w-8 h-8 animate-spin mb-4" />
                              <p>正在生成中...</p>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </TabsContent>

                    <TabsContent value="analysis" className="mt-6 space-y-6">
                      <Card className="bg-card border-border">
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2">
                            <Camera className="w-5 h-5 text-primary" />
                            场景智能
                          </CardTitle>
                          <CardDescription>自动化产品特征提取</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-1">
                              <p className="text-xs text-muted-foreground uppercase font-bold">品类</p>
                              <p className="font-medium">{analysis?.category}</p>
                            </div>
                            <div className="space-y-1">
                              <p className="text-xs text-muted-foreground uppercase font-bold">材质</p>
                              <p className="font-medium">{analysis?.material}</p>
                            </div>
                          </div>
                          <Separator className="bg-border" />
                          <div className="space-y-3">
                            <p className="text-xs text-muted-foreground uppercase font-bold">核心特征</p>
                            <div className="flex flex-wrap gap-2">
                              {analysis?.features.map((f, i) => (
                                <Badge key={i} variant="secondary" className="bg-muted text-foreground hover:bg-accent">
                                  {f}
                                </Badge>
                              ))}
                            </div>
                          </div>
                          <div className="space-y-2">
                            <p className="text-xs text-muted-foreground uppercase font-bold">光影环境</p>
                            <p className="text-muted-foreground text-sm leading-relaxed">{analysis?.lighting}</p>
                          </div>
                        </CardContent>
                      </Card>
                    </TabsContent>

                    <TabsContent value="design" className="mt-6 space-y-6">
                      <div className="grid gap-4">
                        {themes.map((theme, i) => (
                          <Card 
                            key={i} 
                            className={`bg-card border-border cursor-pointer transition-all hover:border-primary/50
                              ${selectedTheme?.name === theme.name ? 'ring-2 ring-primary border-transparent' : ''}`}
                            onClick={() => handleThemeChange(theme)}
                          >
                            <CardContent className="p-4 sm:p-6 flex flex-col sm:flex-row items-start gap-4 sm:gap-6">
                              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-muted flex items-center justify-center shrink-0">
                                <Palette className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
                              </div>
                              <div className="space-y-3 flex-1 w-full">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                  <h3 className="font-bold text-base sm:text-lg">{theme.name}</h3>
                                  <Badge variant="outline" className="w-fit text-[10px] uppercase tracking-tighter">
                                    {theme.mood}
                                  </Badge>
                                </div>
                                <p className="text-sm text-muted-foreground leading-relaxed">{theme.description}</p>
                                <div className="flex items-center gap-2">
                                  {theme.colorPalette.map((color, ci) => (
                                    <div 
                                      key={ci} 
                                      className="w-6 h-6 rounded-full border border-border" 
                                      style={{ backgroundColor: color }}
                                      title={color}
                                    />
                                  ))}
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </TabsContent>

                    <TabsContent value="marketing" className="mt-6 space-y-6">
                      <Card className="bg-card border-border">
                        <CardHeader className="border-b border-border pb-4 sm:pb-6">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                            <Badge className="w-fit bg-red-500/10 text-red-500 border-red-500/20">
                              小红书风格
                            </Badge>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="w-full sm:w-auto text-muted-foreground hover:text-foreground bg-muted/50 sm:bg-transparent"
                              onClick={() => {
                                if (marketing) {
                                  navigator.clipboard.writeText(`${marketing.title}\n\n${marketing.body}\n\n${marketing.tags.map(t => `#${t}`).join(' ')}`);
                                }
                              }}
                            >
                              复制全部
                            </Button>
                          </div>
                          <CardTitle className="text-xl sm:text-2xl font-bold leading-tight">
                            {marketing?.title}
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-8 space-y-8">
                          <div className="grid gap-4">
                            {marketing?.hooks.map((hook, i) => (
                              <div key={i} className="flex items-start gap-3 p-4 bg-accent/30 rounded-lg border border-border">
                                <Sparkles className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                                <p className="text-sm font-medium">{hook}</p>
                              </div>
                            ))}
                          </div>
                          
                          <ScrollArea className="h-[300px] w-full rounded-md border border-border p-6 bg-accent/10">
                            <div className="whitespace-pre-wrap text-foreground leading-loose">
                              {marketing?.body}
                            </div>
                            <div className="mt-8 flex flex-wrap gap-2">
                              {marketing?.tags.map((tag, i) => (
                                <span key={i} className="text-primary text-sm font-medium">#{tag}</span>
                              ))}
                            </div>
                          </ScrollArea>
                        </CardContent>
                      </Card>
                    </TabsContent>
                  </Tabs>
                </motion.div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center space-y-6 p-12 border-2 border-dashed border-border rounded-2xl bg-accent/5">
                  <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center">
                    <ImageIcon className="w-10 h-10 text-muted-foreground" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-xl font-bold text-muted-foreground">等待输入</h3>
                    <p className="text-muted-foreground max-w-xs">
                      上传照片以查看多智能体引擎的工作过程。
                    </p>
                  </div>
                </div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/50 py-8 sm:py-12 mt-12 sm:mt-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 grid grid-cols-1 md:grid-cols-3 gap-8 sm:gap-12">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              <span className="font-bold">AI 视觉引擎</span>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              由火山引擎豆包大模型和 Seedream 5.0 驱动。
              为下一代电子商务而构建。
            </p>
          </div>
          <div className="space-y-4">
            <h4 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">智能体</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>智能体 A: 场景分析师</li>
              <li>智能体 B: 审美设计师</li>
              <li>智能体 D: 视觉生成师</li>
              <li>智能体 C: 营销策划师</li>
            </ul>
          </div>
          <div className="space-y-4">
            <h4 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">状态</h4>
            <div className="flex items-center gap-2 text-sm text-green-500">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              所有系统运行正常
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
