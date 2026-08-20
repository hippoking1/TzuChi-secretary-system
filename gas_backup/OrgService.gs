/**
 * OrgService.gs
 * 慈濟活動報名系統 — 組織架構服務 (和氣 -> 互愛 -> 協力)
 */

/**
 * 取得完整組織樹狀結構
 */
function getOrgTree() {
  const orgs = readAll(SHEETS.ORGS).filter(o => 
    o.isActive !== false && String(o.isActive).toUpperCase() !== 'FALSE'
  );

  const map = {};
  orgs.forEach(o => {
    map[String(o.id)] = { ...o, id: String(o.id), children: [] };
  });

  const tree = [];
  orgs.forEach(o => {
    const parentIdStr = o.parentId ? String(o.parentId) : '';
    if (parentIdStr && map[parentIdStr] && parentIdStr !== String(o.id)) {
      map[parentIdStr].children.push(map[String(o.id)]);
    } else {
      tree.push(map[String(o.id)]);
    }
  });

  const sortChildren = (nodes, visited = new Set()) => {
    nodes.sort((a, b) => (Number(a.sortOrder) || 0) - (Number(b.sortOrder) || 0));
    nodes.forEach(n => {
      if (!visited.has(n.id)) {
        visited.add(n.id);
        if (n.children && n.children.length > 0) {
          sortChildren(n.children, visited);
        }
      } else {
        n.children = [];
      }
    });
  };
  sortChildren(tree);

  return tree;
}

/**
 * 取得所有組織 (無過濾)
 */
function getAllOrgs() {
  return readAll(SHEETS.ORGS);
}

/**
 * 取得指定組織的全路徑名稱 (例: 第一和氣 / 第一互愛 / 第一協力)
 */
function getOrgPath(orgId) {
  if (!orgId) return '未分組';
  const orgs = readAll(SHEETS.ORGS);
  const parts = [];
  const visited = new Set();
  let current = orgs.find(o => String(o.id) === String(orgId));

  while (current && !visited.has(String(current.id))) {
    visited.add(String(current.id));
    parts.unshift(current.name);
    current = current.parentId ? orgs.find(o => String(o.id) === String(current.parentId)) : null;
  }

  return parts.length > 0 ? parts.join(' / ') : '未知組織';
}

/**
 * 取得特定組織及其所有下級組織 ID 陣列
 */
function getDescendantOrgIds(orgId) {
  const orgs = readAll(SHEETS.ORGS);
  const result = [];

  function collect(parentId) {
    orgs.filter(o => String(o.parentId) === String(parentId)).forEach(o => {
      result.push(o.id);
      collect(o.id);
    });
  }

  collect(orgId);
  return result;
}

/**
 * 新增組織
 */
function createOrg(token, orgData) {
  if (!isAdmin(token)) return { error: '權限不足' };

  const id = insertRow(SHEETS.ORGS, {
    ...orgData,
    isActive: true,
    createdAt: new Date().toISOString()
  });

  logAction('CREATE_ORG', 'org', id, orgData);
  return { success: true, id: id };
}

/**
 * 更新組織
 */
function updateOrg(token, id, updates) {
  if (!isAdmin(token)) return { error: '權限不足' };

  updateById(SHEETS.ORGS, id, updates);
  logAction('UPDATE_ORG', 'org', id, updates);
  return { success: true };
}

/**
 * 刪除組織 (連同刪除其所有下級組織)
 */
function deleteOrg(token, id) {
  if (!isAdmin(token)) return { error: '權限不足' };

  const descendantIds = getDescendantOrgIds(id);
  descendantIds.push(id);

  descendantIds.forEach(targetId => {
    deleteById(SHEETS.ORGS, targetId);
  });

  logAction('DELETE_ORG', 'org', id, { deletedIds: descendantIds });
  return { success: true };
}
