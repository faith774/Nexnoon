import { useId } from 'react';
import type { ClassDetails } from '@/types/api';

export default function ClassDetailsEditor({ value, onChange }: { value: ClassDetails; onChange: (value: ClassDetails) => void }) {
  const id = useId();
  const field = (label: string, key: string, text: string, update: (text: string) => void) => <div key={key}>
    <label htmlFor={`${id}-${key}`} className="block text-sm font-medium text-gray-700 mb-2">{label}</label>
    <textarea id={`${id}-${key}`} value={text} onChange={e => update(e.target.value)} rows={3} className="w-full border border-gray-300 rounded-xl p-3" />
  </div>;
  return <section className="space-y-6 mb-10">
    <h2 className="text-2xl font-bold">Full Class Details</h2>
    <p className="text-gray-600">These details appear on your public class page. Add your full overview, curriculum, projects, biography, and FAQs.</p>
    {([['Course overview', 'overview'], ['Instructor professional title', 'instructorTitle'], ['Instructor biography', 'instructorBio'], ['Instructor photo URL', 'instructorImage'], ['Preview video URL (HTTPS MP4 or WebM)', 'previewVideoUrl'], ['Curriculum introduction', 'curriculumIntro'], ['Certificate availability and requirements', 'certificateInfo']] as const).map(([label, key]) => field(label, key, value[key] || '', text => onChange({ ...value, [key]: text })))}
    {field('By the end of the course (one outcome per line)', 'outcomes', (value.outcomes || []).join('\n'), text => onChange({ ...value, outcomes: text.split('\n') }))}
    <h3 className="text-xl font-bold">Curriculum and projects</h3>
    {(value.curriculum || []).map((module, index) => <div key={index} className="border rounded-xl p-5 space-y-4">
      {field('Module title', `module-${index}`, module.title, title => onChange({ ...value, curriculum: value.curriculum!.map((m, i) => i === index ? { ...m, title } : m) }))}
      {field('Topics (one per line)', `topics-${index}`, module.topics.join('\n'), text => onChange({ ...value, curriculum: value.curriculum!.map((m, i) => i === index ? { ...m, topics: text.split('\n') } : m) }))}
      {field('Hands-on project', `project-${index}`, module.project, project => onChange({ ...value, curriculum: value.curriculum!.map((m, i) => i === index ? { ...m, project } : m) }))}
      <button type="button" className="text-red-700 underline" onClick={() => onChange({ ...value, curriculum: value.curriculum!.filter((_, i) => i !== index) })}>Remove module</button>
    </div>)}
    <button type="button" className="border rounded-lg px-4 py-2" onClick={() => onChange({ ...value, curriculum: [...(value.curriculum || []), { title: '', topics: [], project: '' }] })}>Add module</button>
    <h3 className="text-xl font-bold">Frequently asked questions</h3>
    {(value.faqs || []).map((faq, index) => <div key={index} className="border rounded-xl p-5 space-y-4">
      {field('Question', `question-${index}`, faq.question, question => onChange({ ...value, faqs: value.faqs!.map((f, i) => i === index ? { ...f, question } : f) }))}
      {field('Answer', `answer-${index}`, faq.answer, answer => onChange({ ...value, faqs: value.faqs!.map((f, i) => i === index ? { ...f, answer } : f) }))}
      <button type="button" className="text-red-700 underline" onClick={() => onChange({ ...value, faqs: value.faqs!.filter((_, i) => i !== index) })}>Remove question</button>
    </div>)}
    <button type="button" className="border rounded-lg px-4 py-2" onClick={() => onChange({ ...value, faqs: [...(value.faqs || []), { question: '', answer: '' }] })}>Add FAQ</button>
  </section>;
}
