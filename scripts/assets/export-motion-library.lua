-- Run in Aseprite. Keep full authored cels; do not trim, rescale or center visible bounds.
local root=assert(app.params.root,"Pass root=<repository>")
local function path(relative) return app.fs.joinPath(root,relative) end
local function read(relative)
  local file=assert(io.open(path(relative),"r"));local value=json.decode(file:read("*a"));file:close();return value
end
local function write(relative,value)
  local file=assert(io.open(path(relative),"w"));file:write(json.encode(value));file:close()
end
local function round(value) return math.floor(value+.5) end
local config=read("scripts/assets/motion-library.config.json")
local report={tool="Aseprite",version=tostring(app.version),assets={},galleries={}}
local library={}
local gallery, galleryRows, page=nil,{},0
local function saveGallery()
  if not gallery then return end
  local file=string.format("docs/reviews/assets/2026-10-21-motion-library-%02d.png",page)
  gallery:saveAs(path(file));table.insert(report.galleries,{path=file,rows=galleryRows})
end
for assetIndex,source in ipairs(config.assets) do
  local original=Image{fromFile=path(source.source)}
  assert(original.width==1536 and original.height==1024,"Unexpected reference layout")
  local recovered="art/animations/recovered/"..source.sourceStem..".aseprite"
  local editable="art/animations/"..source.stem..".aseprite"
  local rebuilding=app.params.rebuild=="true" or not app.fs.isFile(path(editable))
  local recoveredSource=rebuilding and app.fs.isFile(path(recovered)) and Sprite{fromFile=path(recovered)} or nil
  local sourceData
  if recoveredSource then
    local valid,value=pcall(json.decode,recoveredSource.data)
    assert(valid and value and value.anchor,"Recovered source must declare its presentation")
    sourceData=value
  end
  local width,height=416,544
  if recoveredSource then width=recoveredSource.width;height=recoveredSource.height end
  local sprite=rebuilding and Sprite(width,height,ColorMode.RGB) or Sprite{fromFile=path(editable)}
  width=sprite.width;height=sprite.height
  local anchor={x=208,y=272}
  if sourceData then anchor={x=sourceData.anchor.x,y=sourceData.anchor.y} end
  if not rebuilding then
    local saved=json.decode(sprite.data);sourceData=saved;anchor={x=saved.anchor.x,y=saved.anchor.y}
  end
  local recoveredPath=recoveredSource and recovered or sourceData and sourceData.recoveredSource or nil
  local sourceReference=sourceData and (sourceData.sourceReference or sourceData.source) or source.source
  local item={sourceStem=source.sourceStem,source=source.source,editable=editable,
    width=width,height=height,anchor=anchor,duration=source.duration,impactAt=source.impactAt,
    sourcePixelsPreserved=true,recoveredSource=recoveredPath,sourceReference=sourceReference,frames={}}
  if rebuilding then
    sprite.layers[1].name="Illustrated frames"
    local slice=sprite:newSlice(Rectangle(anchor.x-192,anchor.y-256,384,512));slice.name="presentation";slice.pivot=Point(192,256)
  else assert(#sprite.frames==8,"Editable source count changed") end
  -- Invert the same monotone Hermite clock used in library-motion-clock.ts.
  -- Editor frame starts therefore match the continuously sampled game phases.
  local function position(time)
    local beat,total=source.impactAt,source.duration
    local before,after=3/beat,4/(total-beat)
    local w0,w1=2*(total-beat)+beat,total-beat+2*beat
    local tangent=(w0+w1)/(w0/before+w1/after)
    local first=time<=beat
    local length=first and beat or total-beat
    local t=(time-(first and 0 or beat))/length
    local t2,t3=t*t,t*t*t
    local from,to=first and 0 or 3,first and 3 or 7
    local startSlope,endSlope=first and 0 or tangent,first and tangent or 0
    return (2*t3-3*t2+1)*from+(t3-2*t2+t)*length*startSlope+(-2*t3+3*t2)*to+(t3-t2)*length*endSlope
  end
  local function boundary(index)
    if index==8 then return source.duration end
    if index==7 then return source.duration-1 end
    if index==3 then return source.impactAt end
    local low,high=0,source.duration
    for iteration=1,40 do
      local mid=(low+high)/2
      if position(mid)<index then low=mid else high=mid end
    end
    return round((low+high)/2)
  end
  for index=0,7 do
    local cut=Image(original,Rectangle(index%4*384,math.floor(index/4)*512,384,512))
    local sourceContacts=0
    for pixel in cut:pixels() do
      if (pixel.x==0 or pixel.x==383 or pixel.y==0 or pixel.y==511) and app.pixelColor.rgbaA(pixel())>=16 then sourceContacts=sourceContacts+1 end
    end
    local image=Image(width,height,ColorMode.RGB)
    if rebuilding then
      if recoveredSource then image:drawSprite(recoveredSource,index+1) else image:drawImage(cut,Point(16,16)) end
      if index>0 then sprite:newEmptyFrame() end
      sprite:newCel(sprite.layers[1],index+1,image,Point(0,0))
    else image:drawSprite(sprite,index+1) end
    local edge,visible=0,0
    for pixel in image:pixels() do
      local alpha=app.pixelColor.rgbaA(pixel())
      if pixel.x==0 or pixel.y==0 or pixel.x==width-1 or pixel.y==height-1 then edge=math.max(edge,alpha) end
      if alpha>=16 then visible=visible+1 end
    end
    assert(visible>0,"Empty source cel")
    assert(edge<16,"Exported cel needs safe padding: "..source.stem.."/"..index)
    local duration=boundary(index+1)-boundary(index);assert(duration>0)
    if rebuilding then sprite.frames[index+1].duration=duration/1000
    else assert(round(sprite.frames[index+1].duration*1000)==duration,"Saved timeline no longer matches the game") end
    table.insert(item.frames,{index=index,duration=duration,maxEdgeAlpha=edge,originalGridBoundaryPixels=sourceContacts})
  end
  if rebuilding then
    sprite:newTag(1,3).name="Preparation";sprite:newTag(4,4).name="Impact";sprite:newTag(5,8).name="Recovery"
    sprite.data=json.encode({anchor=anchor,presentationSize={width=384,height=512},
      reference=source.source,recoveredSource=recoveredPath,sourceReference=sourceReference,
      note="Original grid contacts remain diagnosed separately. Padding is not a source repair."})
    sprite:saveAs(path(editable))
  end
  if recoveredSource then recoveredSource:close() end
  app.sprite=sprite
  local sheet="apps/client/public/assets/vfx/"..source.stem..".png"
  local metadata="apps/client/public/assets/vfx/"..source.stem..".json"
  app.command.ExportSpriteSheet{ui=false,askOverwrite=false,type=SpriteSheetType.ROWS,columns=4,
    textureFilename=path(sheet),dataFilename=path(metadata),dataFormat=SpriteSheetDataFormat.JSON_ARRAY,
    filenameFormat="{frame}",borderPadding=0,shapePadding=0,innerPadding=0,trim=false,
    trimSprite=false,extrude=false,ignoreEmpty=false,mergeDuplicates=false,listTags=true,listLayers=true,listSlices=true}
  local atlas=read(metadata);local pixels=Image{fromFile=path(sheet)}
  assert(#atlas.frames==8)
  local presentation
  for _,slice in ipairs(atlas.meta.slices) do if slice.name=="presentation" then presentation=slice.keys[1] end end
  assert(presentation and presentation.bounds.w==384 and presentation.bounds.h==512,"Preserve original presentation sizing")
  anchor={x=presentation.bounds.x+presentation.pivot.x,y=presentation.bounds.y+presentation.pivot.y}
  item.anchor=anchor
  local frames={}
  local reopened=Sprite{fromFile=path(editable)}
  assert(#reopened.frames==8 and reopened.width==width and reopened.height==height)
  if (assetIndex-1)%6==0 then
    saveGallery();page=page+1;gallery=Image(768,768,ColorMode.RGB);gallery:clear(app.pixelColor.rgba(13,25,42,255));galleryRows={}
  end
  local row=(assetIndex-1)%6;table.insert(galleryRows,source.stem)
  for index,frame in ipairs(atlas.frames) do
    local rect=frame.frame
    assert(rect.w==width and rect.h==height and not frame.trimmed and not frame.rotated)
    assert(frame.duration==item.frames[index].duration)
    local actual=Image(pixels,Rectangle(rect.x,rect.y,rect.w,rect.h))
    local expected=Image(width,height,ColorMode.RGB);expected:drawSprite(sprite,index)
    local saved=Image(width,height,ColorMode.RGB);saved:drawSprite(reopened,index)
    assert(actual:isEqual(expected) and saved:isEqual(expected),"Pixel reimport mismatch")
    assert(round(reopened.frames[index].duration*1000)==frame.duration)
    table.insert(frames,{frame={x=rect.x,y=rect.y,w=rect.w,h=rect.h},rotated=false,trimmed=false,
      spriteSourceSize={x=0,y=0,w=width,h=height},sourceSize={w=width,h=height},duration=frame.duration})
    local navy=Image(width,height,ColorMode.RGB);navy:clear(app.pixelColor.rgba(13,25,42,255));navy:drawImage(actual)
    local scale=math.min(96/width,128/height);navy:resize(round(width*scale),round(height*scale))
    gallery:drawImage(navy,Point((index-1)*96+math.floor((96-navy.width)/2),row*128+math.floor((128-navy.height)/2)))
  end
  reopened:close();sprite:close()
  item.reimportVerified=true;item.sheet=sheet;item.metadata=metadata
  table.insert(report.assets,item)
  table.insert(library,{sourceKey="vfx:"..source.sourceStem,textureKey="vfx:"..source.stem,
    count=8,peak=3,stretch=source.stretch,anchor=anchor,presentationSize={width=384,height=512},
    atlas={meta={size={w=atlas.meta.size.w,h=atlas.meta.size.h}},frames=frames}})
  print(source.stem..": saved/exported/reopened 8 cels")
end
saveGallery()
assert(#report.assets==49)
write("docs/assets/motion-library-audit.json",report)
write("apps/client/src/ui/motion-library-data.json",library)
