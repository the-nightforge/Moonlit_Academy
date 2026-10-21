-- Run in Aseprite batch mode with --script-param root=<repository>.
-- Ownership changes only: every nonzero-alpha source pixel is retained once,
-- with unchanged RGBA. Ambiguous joined illustrations remain explicitly unresolved.
local root=assert(app.params.root,"Pass root=<repository>")
app.fs.makeAllDirectories(root.."/art/animations/recovered")
app.fs.makeAllDirectories(root.."/.tmp/remaining-art-audit")
-- Aseprite JSON values are userdata. Convert arrays via ipairs and objects via
-- pairs before nesting them in plain Lua reports; raw userdata encodes as null.
local function plain(value)
  if type(value)~="userdata" and type(value)~="table" then return value end
  local result={};local isArray=false;pcall(function() isArray=value[1]~=nil end)
  if isArray then for i,v in ipairs(value) do result[i]=plain(v) end
  else for k,v in pairs(value) do result[k]=plain(v) end end
  return result
end
local function read(relative)
  local f=assert(io.open(root.."/"..relative,"r"));local v=plain(json.decode(f:read("*a")));f:close();return v
end
local config=read("docs/assets/motion-source-recovery.json")
local sources=config.assets
if app.params.only then
  local names={};for stem in tostring(app.params.only):gmatch("[^,]+") do names[stem]=true end
  local selected={};for _,a in ipairs(config.assets) do if names[a.stem] then selected[#selected+1]=a;names[a.stem]=nil end end
  assert(next(names)==nil and #selected>0,"Unknown recovery source selection");sources=selected
end
local outputPrefix=app.params.prefix or "recovered"
local w,h=1536,1024
local report={tool="Aseprite",version=tostring(app.version),assets={},limitations=config.limitations,
  visualInspectionRequired=true,ownership=config.ownership}
local gallery,pageRows,pageIndex=nil,{},0
local function saveGallery()
  if gallery then gallery:saveAs(root.."/.tmp/remaining-art-audit/"..outputPrefix.."-gallery-"..string.format("%02d",pageIndex)..".png") end
end
for assetIndex,a in ipairs(sources) do
  local src=Image{fromFile=root.."/"..a.path};assert(src.width==w and src.height==h)
  local coreAlpha=a.coreAlpha or config.coreAlpha
  local item={stem=a.stem,source=a.path,sourceSha256=a.sourceSha256,recovered=false,
    severity=a.severity,coreAlpha=coreAlpha,originalBoundaryContacts=a.originalBoundaryContacts,
    sourceBoundaryContactPixels=0,sourceBoundaryContactFrames=0,unresolved={}}
  local outer={}
  for _,f in ipairs(a.originalBoundaryContacts) do
    local i=f.index;local e=f.edgePixels
    local edgeCount=e.left+e.right+e.top+e.bottom
    item.sourceBoundaryContactPixels=item.sourceBoundaryContactPixels+edgeCount
    if edgeCount>0 then item.sourceBoundaryContactFrames=item.sourceBoundaryContactFrames+1 end
    if (i%4==0 and e.left>0) or (i%4==3 and e.right>0) or (i<4 and e.top>0) or (i>=4 and e.bottom>0) then table.insert(outer,i) end
  end
  if #outer>0 then table.insert(item.unresolved,{kind="original-sheet-outer-edge-contact",frames=outer,note="Original pixels beyond the sheet do not exist; segmentation cannot reconstruct them."}) end
  local images,width,height,anchorX,anchorY
  if a.recover then
    local parent,runs,previous,stats={},{},{},{}
    local function find(n) while parent[n]~=n do parent[n]=parent[parent[n]];n=parent[n] end;return n end
    local function union(x,y) x=find(x);y=find(y);if x~=y then parent[y]=x end end
    for y=0,h-1 do
      local row={};local x=0
      while x<w do
        if app.pixelColor.rgbaA(src:getPixel(x,y))>=coreAlpha then
          local left=x;repeat x=x+1 until x>=w or app.pixelColor.rgbaA(src:getPixel(x,y))<coreAlpha
          local id=#parent+1;parent[id]=id
          local run={y=y,left=left,right=x-1,id=id};row[#row+1]=run;runs[#runs+1]=run
          for _,p in ipairs(previous) do if p.right>=left-1 and p.left<=x then union(id,p.id) end end
        else x=x+1 end
      end
      previous=row
    end
    for _,r in ipairs(runs) do
      local id=find(r.id);local s=stats[id]
      if not s then s={pixels=0,cells={0,0,0,0,0,0,0,0}};stats[id]=s end
      s.pixels=s.pixels+r.right-r.left+1
      local yy=math.floor(r.y/512)
      for col=0,3 do local n=math.max(0,math.min(r.right,(col+1)*384-1)-math.max(r.left,col*384)+1);s.cells[yy*4+col+1]=s.cells[yy*4+col+1]+n end
    end
    for componentId,s in pairs(stats) do
      local biggest,second,owner=0,0,1
      for i,n in ipairs(s.cells) do if n>biggest then second=biggest;biggest=n;owner=i elseif n>second then second=n end end
      local override=a.componentOverrides and a.componentOverrides[tostring(componentId)]
      if override then
        assert(s.pixels==override.expectedPixels,"Source component changed; reinspect ownership")
        owner=override.owner
      else assert(not(second>=1000 and second/s.pixels>0.12),"New ambiguous component: "..a.stem) end
      s.owner=owner
    end
    -- Multi-source breadth-first propagation assigns lower-alpha fringe pixels.
    -- Core ownership is fixed by whole connected components, including grid spill.
    local owners,queue={},{}
    for _,r in ipairs(runs) do
      local owner=stats[find(r.id)].owner
      for x=r.left,r.right do local n=r.y*w+x+1;owners[n]=owner;queue[#queue+1]=n end
    end
    local cursor=1
    while cursor<=#queue do
      local n=queue[cursor];cursor=cursor+1;local owner=owners[n];local x=(n-1)%w
      if x>0 and not owners[n-1] then owners[n-1]=owner;queue[#queue+1]=n-1 end
      if x<w-1 and not owners[n+1] then owners[n+1]=owner;queue[#queue+1]=n+1 end
      if n>w and not owners[n-w] then owners[n-w]=owner;queue[#queue+1]=n-w end
      if n<=w*(h-1) and not owners[n+w] then owners[n+w]=owner;queue[#queue+1]=n+w end
    end
    queue=nil;runs=nil;parent=nil;stats=nil;collectgarbage("collect")
    local shifts,provenance,bounds={},{},{minX=0,minY=0,maxX=383,maxY=511}
    local landmark=config.landmarks[a.stem]
    for i=1,8 do
      local dx,dy=0,0
      if landmark then dx=landmark.target[1]-landmark.points[i][1];dy=landmark.target[2]-landmark.points[i][2] end
      shifts[i]={x=dx,y=dy};provenance[i]={frame=i-1,pixels=0,corePixels=0,recoveredCoreSpill=0,shift={x=dx,y=dy}}
    end
    for pixel in src:pixels() do
      local alpha=app.pixelColor.rgbaA(pixel())
      if alpha>0 then
        local i=owners[pixel.y*w+pixel.x+1];local sx=(i-1)%4*384;local sy=math.floor((i-1)/4)*512
        local x=pixel.x-sx+shifts[i].x;local y=pixel.y-sy+shifts[i].y
        bounds.minX=math.min(bounds.minX,x);bounds.minY=math.min(bounds.minY,y);bounds.maxX=math.max(bounds.maxX,x);bounds.maxY=math.max(bounds.maxY,y)
        local p=provenance[i];p.pixels=p.pixels+1
        if alpha>=16 then p.corePixels=p.corePixels+1;if pixel.x<sx or pixel.x>=sx+384 or pixel.y<sy or pixel.y>=sy+512 then p.recoveredCoreSpill=p.recoveredCoreSpill+1 end end
      end
    end
    local left=config.minPadding-bounds.minX;local top=config.minPadding-bounds.minY
    width=bounds.maxX-bounds.minX+1+config.minPadding*2;height=bounds.maxY-bounds.minY+1+config.minPadding*2
    anchorX=left+192;anchorY=top+256;images={}
    for i=1,8 do images[i]=Image(width,height,ColorMode.RGB) end
    for pixel in src:pixels() do if app.pixelColor.rgbaA(pixel())>0 then
      local i=owners[pixel.y*w+pixel.x+1]
      local x=pixel.x-(i-1)%4*384+shifts[i].x+left;local y=pixel.y-math.floor((i-1)/4)*512+shifts[i].y+top
      assert(app.pixelColor.rgbaA(images[i]:getPixel(x,y))==0,"Source pixel collision")
      images[i]:putPixel(x,y,pixel())
    end end
    local sprite=Sprite(width,height,ColorMode.RGB);sprite.layers[1].name="Original pixels recovered from source sheet"
    for i=1,8 do if i>1 then sprite:newEmptyFrame() end;sprite:newCel(sprite.layers[1],i,images[i],Point(0,0));sprite.frames[i].duration=0.1 end
    sprite.data=json.encode({anchor={x=anchorX,y=anchorY},presentationSize={width=384,height=512},preservedPixels=true,
      recovery="component-ownership",source=a.path,frameTranslations=shifts,sourcePixelProvenance=provenance,
      alignment=landmark and landmark.feature or "original-canvas",unresolved=item.unresolved})
    local editable="art/animations/recovered/"..a.stem..".aseprite";sprite:saveAs(root.."/"..editable)
    local saved=Sprite{fromFile=root.."/"..editable};assert(#saved.frames==8 and saved.width==width and saved.height==height)
    local verified=0
    for pixel in src:pixels() do if app.pixelColor.rgbaA(pixel())>0 then
      local i=owners[pixel.y*w+pixel.x+1];local x=pixel.x-(i-1)%4*384+shifts[i].x+left;local y=pixel.y-math.floor((i-1)/4)*512+shifts[i].y+top
      local cel=saved.layers[1]:cel(i);assert(cel.image:getPixel(x-cel.position.x,y-cel.position.y)==pixel(),"Saved source RGBA mismatch")
      verified=verified+1
    end end
    item.recovered=true;item.editable=editable;item.width=width;item.height=height;item.anchor={x=anchorX,y=anchorY};item.presentationSize={width=384,height=512}
    item.frames=provenance;item.nonzeroSourcePixelsVerified=verified;item.provenanceVerified=true;item.alignment=landmark
    saved:close();sprite:close();owners=nil;collectgarbage("collect")
  else
    table.insert(item.unresolved,{kind="merged-source-motifs",components=a.ambiguousComponents,note="Competing illustrated motifs join across nominal cells; no ownership is inferred or artwork discarded."})
    width=384;height=512;anchorX=192;anchorY=256;images={}
    for i=0,7 do images[i+1]=Image(src,Rectangle(i%4*384,math.floor(i/4)*512,384,512)) end
  end
  local row=(assetIndex-1)%6
  if row==0 then saveGallery();pageIndex=pageIndex+1;gallery=Image(768,768,ColorMode.RGB);gallery:clear(app.pixelColor.rgba(11,21,42,255));pageRows[pageIndex]={} end
  pageRows[pageIndex][row+1]=a.stem..(item.recovered and " recovered" or " ORIGINAL UNRESOLVED")
  -- Full-canvas contain inspection preserves every recovered edge, including spill.
  for i=1,8 do
    local scale=math.min(96/width,128/height)
    local scaled=images[i]:clone();scaled:resize(math.max(1,math.floor(width*scale+0.5)),math.max(1,math.floor(height*scale+0.5)))
    local tile=Image(96,128,ColorMode.RGB);tile:clear(app.pixelColor.rgba(11,21,42,255))
    tile:drawImage(scaled,Point(math.floor((96-scaled.width)/2),math.floor((128-scaled.height)/2)))
    gallery:drawImage(tile,Point((i-1)*96,row*128))
  end
  report.assets[#report.assets+1]=item
  print(a.stem..": "..(item.recovered and "recovered; exact RGBA provenance verified" or "UNRESOLVED; original retained"))
end
saveGallery()
local reportName=app.params.only and outputPrefix.."-results.json" or "recovery-results.json"
local f=assert(io.open(root.."/.tmp/remaining-art-audit/"..reportName,"w"));f:write(json.encode(report));f:close()
local finalReport=report
if app.params.only and app.fs.isFile(root.."/docs/assets/motion-source-recovery-audit.json") then
  local previous=read("docs/assets/motion-source-recovery-audit.json");local byStem={}
  for _,a in ipairs(previous.assets) do byStem[a.stem]=a end
  for _,a in ipairs(report.assets) do byStem[a.stem]=a end
  finalReport={tool=report.tool,version=report.version,ownership=config.ownership,limitations=config.limitations,
    visualInspectionRequired=true,assets={}}
  for _,a in ipairs(config.assets) do assert(byStem[a.stem],"Incomplete merged recovery audit");finalReport.assets[#finalReport.assets+1]=byStem[a.stem] end
end
finalReport.sourceCount=#finalReport.assets;finalReport.recoveredSources=0;finalReport.recoveredFrames=0
finalReport.nonzeroSourcePixelsVerified=0;finalReport.recoveredCoreSpillPixels=0
finalReport.sourceOuterEdgeContactSources=0;finalReport.strongSourceOuterEdgeContactSources=0
for _,a in ipairs(finalReport.assets) do if a.recovered then
  finalReport.recoveredSources=finalReport.recoveredSources+1;finalReport.recoveredFrames=finalReport.recoveredFrames+8
  finalReport.nonzeroSourcePixelsVerified=finalReport.nonzeroSourcePixelsVerified+a.nonzeroSourcePixelsVerified
  for _,frame in ipairs(a.frames) do finalReport.recoveredCoreSpillPixels=finalReport.recoveredCoreSpillPixels+frame.recoveredCoreSpill end
end end
for _,a in ipairs(finalReport.assets) do
  local outer,strong=false,false
  for _,f in ipairs(a.originalBoundaryContacts or {}) do
    local i=f.index;local e=f.maxEdgeAlpha
    local maximum=0
    if i%4==0 then maximum=math.max(maximum,e.left) end
    if i%4==3 then maximum=math.max(maximum,e.right) end
    if i<4 then maximum=math.max(maximum,e.top) end
    if i>=4 then maximum=math.max(maximum,e.bottom) end
    outer=outer or maximum>=16;strong=strong or maximum>=128
  end
  if outer then finalReport.sourceOuterEdgeContactSources=finalReport.sourceOuterEdgeContactSources+1 end
  if strong then finalReport.strongSourceOuterEdgeContactSources=finalReport.strongSourceOuterEdgeContactSources+1 end
end
finalReport.title=finalReport.recoveredSources.." recovered animation sources; "..(finalReport.sourceCount-finalReport.recoveredSources).." original sources retained with unresolved merged motifs"
if finalReport.strongSourceOuterEdgeContactSources>0 then finalReport.title=finalReport.title.."; "..finalReport.strongSourceOuterEdgeContactSources.." sources retain strong outer-edge contacts" end
local f=assert(io.open(root.."/docs/assets/motion-source-recovery-audit.json","w"));f:write(json.encode(finalReport));f:close()
local f=assert(io.open(root.."/.tmp/remaining-art-audit/"..outputPrefix.."-gallery-rows.txt","w"));for p,rows in ipairs(pageRows) do f:write(outputPrefix.."-gallery-"..string.format("%02d",p)..".png\n");for row,label in ipairs(rows) do f:write((row-1).." "..label.."\n") end end;f:close()
