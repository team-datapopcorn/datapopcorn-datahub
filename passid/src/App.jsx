import React, { useState } from 'react';
import { Upload, Check, Star, HelpCircle, Menu, X, ArrowRight, Copy, CheckCircle2, Wand2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Editor from './components/Editor';
import { ID_PHOTO_PROMPTS } from './constants/prompts';

function App() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showEditor, setShowEditor] = useState(false);

  // Smooth scroll
  const scrollTo = (id) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
      setIsMenuOpen(false);
    }
  };

  if (showEditor) {
    return <Editor onBack={() => setShowEditor(false)} />;
  }

  return (
    <div className="min-h-screen font-sans text-gray-900 overflow-x-hidden">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex-shrink-0 flex items-center cursor-pointer" onClick={() => window.scrollTo(0, 0)}>
              <span className="text-xl font-bold tracking-tight">PassID</span>
            </div>

            {/* Desktop Menu */}
            <div className="hidden md:flex items-center space-x-8">
              <button onClick={() => scrollTo('features')} className="text-sm font-medium hover:text-primary transition-colors">Service</button>
              <button onClick={() => scrollTo('guide')} className="text-sm font-medium hover:text-primary transition-colors">Guide</button>
              <button onClick={() => scrollTo('pricing')} className="text-sm font-medium hover:text-primary transition-colors">Pricing</button>
              <button onClick={() => scrollTo('reviews')} className="text-sm font-medium hover:text-primary transition-colors">Reviews</button>
              <button onClick={() => scrollTo('faq')} className="text-sm font-medium hover:text-primary transition-colors">FAQ</button>
              <button
                onClick={() => setShowEditor(true)}
                className="bg-black text-white px-5 py-2.5 rounded-full text-sm font-medium hover:bg-gray-800 transition-all hover:scale-105 active:scale-95"
              >
                Start for Free
              </button>
            </div>

            {/* Mobile Menu Button */}
            <div className="md:hidden flex items-center">
              <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="p-2">
                {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Menu */}
        <AnimatePresence>
          {isMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="md:hidden bg-white border-b border-gray-100 overflow-hidden"
            >
              <div className="px-4 py-4 space-y-4">
                <button onClick={() => scrollTo('features')} className="block w-full text-left text-base font-medium">Service</button>
                <button onClick={() => scrollTo('guide')} className="block w-full text-left text-base font-medium">Guide</button>
                <button onClick={() => scrollTo('pricing')} className="block w-full text-left text-base font-medium">Pricing</button>
                <button onClick={() => scrollTo('reviews')} className="block w-full text-left text-base font-medium">Reviews</button>
                <button onClick={() => scrollTo('faq')} className="block w-full text-left text-base font-medium">FAQ</button>
                <button
                  onClick={() => {
                    setIsMenuOpen(false);
                    setShowEditor(true);
                  }}
                  className="w-full bg-black text-white px-5 py-3 rounded-xl text-base font-medium"
                >
                  Start for Free
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      <main>
        {/* Hero Section */}
        <section className="relative pt-20 pb-32 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto text-center">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl sm:text-6xl font-extrabold tracking-tight mb-6"
          >
            Studio Quality ID Photos<br />
            <span className="text-gray-400">Created with AI in Seconds</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-lg text-gray-600 mb-10 max-w-2xl mx-auto"
          >
            No need to visit a photo studio. Create professional passport, resume, and ID photos from home with our advanced AI technology.
          </motion.p>

          {/* Upload Area (Entry Point) */}
          <motion.div
            id="upload"
            onClick={() => setShowEditor(true)}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="max-w-2xl mx-auto bg-gray-50 rounded-3xl border-2 border-dashed border-gray-300 p-12 hover:border-gray-400 hover:bg-gray-100 transition-colors cursor-pointer group"
          >
            <div className="flex flex-col items-center">
              <div className="bg-white p-4 rounded-full shadow-sm mb-4 group-hover:scale-110 transition-transform">
                <Upload size={32} className="text-blue-600" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Upload your photo</h3>
              <p className="text-gray-500 mb-6">Drag & drop or click to select</p>
              <button className="bg-blue-600 text-white px-8 py-3 rounded-full font-medium shadow-lg shadow-blue-600/20 hover:bg-blue-700 transition-all hover:shadow-xl">
                Select Photo
              </button>
            </div>
          </motion.div>
        </section>

        {/* Features Section */}
        <section id="features" className="py-24 bg-gray-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-12 text-center">
              <FeatureCard
                icon={<Star className="text-white" />}
                title="AI Transformation"
                desc="Automatically removes backgrounds and enhances lighting for studio results."
                color="bg-purple-500"
              />
              <FeatureCard
                icon={<Check className="text-white" />}
                title="Official Standards"
                desc="Perfectly cropped for Passports, ID Cards, and Visas worldwide."
                color="bg-green-500"
              />
              <FeatureCard
                icon={<ArrowRight className="text-white" />}
                title="Instant Download"
                desc="Get your high-resolution file in seconds. No registration required."
                color="bg-blue-500"
              />
            </div>
          </div>
        </section>

        {/* AI Prompt Guide Section */}
        <section id="guide" className="py-24 bg-white overflow-hidden">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-50 text-blue-600 text-sm font-bold mb-4"
              >
                <Wand2 size={16} />
                <span>Advanced AI Guide</span>
              </motion.div>
              <h2 className="text-3xl md:text-4xl font-bold mb-6">How to Create Professional ID Photos</h2>
              <p className="text-gray-600 max-w-2xl mx-auto">
                Follow these simple steps with Gemini Nano (Pro) to get the best results.
                You can use our highly optimized prompts to achieve studio-quality consistency.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
              {/* Steps */}
              <div className="space-y-8">
                {ID_PHOTO_PROMPTS.GUIDE.steps.map((step, idx) => (
                  <div key={idx} className="flex gap-4">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-black text-white flex items-center justify-center font-bold text-sm">
                      {idx + 1}
                    </div>
                    <div>
                      <p className="text-lg text-gray-800 font-medium">{step}</p>
                    </div>
                  </div>
                ))}

                <div className="p-6 bg-yellow-50 rounded-2xl border border-yellow-100 mt-8">
                  <div className="flex gap-3 text-yellow-800">
                    <HelpCircle className="flex-shrink-0" size={20} />
                    <p className="text-sm">
                      <strong>Tip:</strong> Uploading 3 or more photos helps the AI maintain your identity more accurately.
                    </p>
                  </div>
                </div>
              </div>

              {/* Prompt Buttons */}
              <div className="grid grid-cols-1 gap-6">
                <PromptBox
                  gender="MALE"
                  data={ID_PHOTO_PROMPTS.MALE}
                />
                <PromptBox
                  gender="FEMALE"
                  data={ID_PHOTO_PROMPTS.FEMALE}
                />
              </div>
            </div>
          </div>
        </section>

        {/* Reviews Section */}
        <section id="reviews" className="py-24">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl font-bold text-center mb-16">Trusted by 10,000+ Users</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <ReviewCard
                name="Sarah K."
                text="I needed a passport photo urgently and this saved me! The quality is amazing."
                rating={5}
              />
              <ReviewCard
                name="Michael C."
                text="Better than the studio I went to last year. And 10x cheaper."
                rating={5}
              />
              <ReviewCard
                name="Jessica P."
                text="Super easy to use. The AI background removal is perfect."
                rating={5}
              />
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section id="faq" className="py-24 bg-gray-50">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl font-bold text-center mb-12">Frequently Asked Questions</h2>
            <div className="space-y-4">
              <FaqItem q="Is this suitable for official passports?" a="Yes! We follow strict guidelines for passports. However, always ensure your source photo has good lighting." />
              <FaqItem q="How much does it cost?" a="It is free to try. High-resolution downloads are available for a small fee." />
              <FaqItem q="Do you save my photos?" a="No. Photos are processed in your browser and automatically deleted from our privacy-first servers after 24 hours." />
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-white py-12 border-t border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-gray-500">
          <p>&copy; 2026 PassID. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, desc, color }) {
  return (
    <div className="flex flex-col items-center text-center">
      <div className={`${color} w-12 h-12 rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-gray-200`}>
        {icon}
      </div>
      <h3 className="text-xl font-bold mb-3">{title}</h3>
      <p className="text-gray-500 leading-relaxed">{desc}</p>
    </div>
  );
}

function ReviewCard({ name, text, rating }) {
  return (
    <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
      <div className="flex text-yellow-400 mb-4">
        {[...Array(rating)].map((_, i) => <Star key={i} size={16} fill="currentColor" />)}
      </div>
      <p className="text-gray-600 mb-6 leading-relaxed">"{text}"</p>
      <p className="font-bold">{name}</p>
    </div>
  );
}

function FaqItem({ q, a }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex justify-between items-center p-6 text-left font-medium hover:bg-gray-50 transition-colors"
      >
        {q}
        <ArrowRight size={20} className={`transform transition-transform ${isOpen ? 'rotate-90' : ''}`} />
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            className="overflow-hidden"
          >
            <div className="p-6 pt-0 text-gray-500 leading-relaxed">
              {a}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function PromptBox({ gender, data }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(data.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100 hover:shadow-lg transition-all group">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h3 className="font-bold text-lg">{data.title}</h3>
          <p className="text-sm text-gray-500">{data.description}</p>
        </div>
        <button
          onClick={handleCopy}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${copied ? 'bg-green-100 text-green-600' : 'bg-black text-white hover:bg-gray-800'
            }`}
        >
          {copied ? (
            <>
              <CheckCircle2 size={16} />
              <span>Copied!</span>
            </>
          ) : (
            <>
              <Copy size={16} />
              <span>Copy Prompt</span>
            </>
          )}
        </button>
      </div>
      <div className="relative">
        <div className="bg-white rounded-xl p-4 text-xs font-mono text-gray-400 h-24 overflow-hidden mask-fade-bottom border border-gray-100">
          {data.content}
        </div>
        <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-white to-transparent pointer-events-none rounded-b-xl" />
      </div>
    </div>
  );
}

export default App;
