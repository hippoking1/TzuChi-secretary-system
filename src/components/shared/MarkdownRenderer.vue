<template>
  <div class="markdown-content" v-html="sanitizedContent"></div>
</template>

<script setup>
import { computed } from 'vue';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

const props = defineProps({
  content: { type: String, default: '' }
});

const sanitizedContent = computed(() => {
  if (!props.content) return '<p class="text-muted">尚無說明內容</p>';
  const rawHtml = marked.parse(props.content);
  // DOMPurify 徹底消除 XSS 風險
  return DOMPurify.sanitize(rawHtml, {
    ALLOWED_TAGS: ['p', 'b', 'i', 'em', 'strong', 'a', 'h1', 'h2', 'h3', 'h4', 'ul', 'ol', 'li', 'blockquote', 'hr', 'code', 'pre', 'br'],
    ALLOWED_ATTR: ['href', 'target', 'rel']
  });
});
</script>

<style>
.markdown-content {
  line-height: 1.7;
  color: var(--gray-800);
}
.markdown-content h1, .markdown-content h2, .markdown-content h3 {
  margin-top: 1.25rem;
  margin-bottom: 0.5rem;
  color: var(--primary-900);
}
.markdown-content ul, .markdown-content ol {
  padding-left: 1.5rem;
  margin-bottom: 1rem;
}
.markdown-content blockquote {
  border-left: 4px solid var(--primary-400);
  padding-left: 1rem;
  color: var(--gray-600);
  margin: 1rem 0;
}
</style>
