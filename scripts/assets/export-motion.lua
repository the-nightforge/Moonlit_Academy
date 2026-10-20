-- Run inside Aseprite, with --script-param root=<repository absolute path>.
-- Normalize the accepted source cuts once, preserving their shared virtual canvas.
local root = assert(app.params.root, "Pass --script-param root=<repository>")
local function path(relative) return app.fs.joinPath(root, relative) end
local function readJson(relative)
  local file = assert(io.open(path(relative), "r"))
  local result = json.decode(file:read("*a")); file:close(); return result
end
local function writeJson(relative, value)
  local file = assert(io.open(path(relative), "w"))
  file:write(json.encode(value)); file:close()
end
local function round(value) return math.floor(value + 0.5) end
local sources = readJson("docs/assets/layered-motion-generated.json")
local timings = {
  combat_attack_bow_flow = { duration=1024, impact=496, peak=9 },
  combat_attack_ribbon_flow = { duration=1328, impact=544, peak=10 },
  awakening_f06_flow = { duration=832, impact=208, peak=7 },
}
local report = { tool="Aseprite", version=tostring(app.version), assets={} }
for _, source in ipairs(sources.assets) do
  local timing = timings[source.stem]
  if timing then
    local original = Image{ fromFile=path(source.path) }
    local grid = source.layout
    local width, height = math.ceil(original.width/grid.columns), math.ceil(original.height/grid.rows)
    local editable="art/animations/"..source.stem..".aseprite"
    local rebuilding=app.params.rebuild=="true" or not app.fs.isFile(path(editable))
    local sprite = rebuilding and Sprite(width, height, ColorMode.RGB) or Sprite{fromFile=path(editable)}
    assert(sprite.width==width and sprite.height==height,"Editable canvas dimensions changed")
    if rebuilding then
      sprite.layers[1].name = "Illustrated frames"
      sprite.gridBounds = Rectangle(0, 0, width, height)
    else assert(#sprite.frames==grid.count,"Editable frame count changed") end
    local item = { stem=source.stem, source=source.path, width=width, height=height,
      anchor={x=width/2,y=height/2}, duration=timing.duration, impactAt=timing.impact, frames={} }
    local function boundary(index)
      if index == grid.count then return timing.duration end
      if index == grid.count-1 then return timing.duration-1 end
      if index <= timing.peak then return round(index/timing.peak*timing.impact) end
      return round(timing.impact+(index-timing.peak)/(grid.count-1-timing.peak)*(timing.duration-timing.impact))
    end
    for index=0,grid.count-1 do
      local col, row = index%grid.columns, math.floor(index/grid.columns)
      local nominalX = round(col*original.width/grid.columns)+(grid.offsetX or 0)
      local nominalY = round(row*original.height/grid.rows)+(grid.offsetY or 0)
      local left, top = math.max(0, nominalX), math.max(0, nominalY)
      local right = math.min(original.width,round((col+1)*original.width/grid.columns)+(grid.offsetX or 0))
      local bottom = math.min(original.height,round((row+1)*original.height/grid.rows)+(grid.offsetY or 0))
      local image = Image(width, height, ColorMode.RGB)
      if rebuilding then
        local pixels = Image(original, Rectangle(left,top,right-left,bottom-top))
        image:drawImage(pixels, Point(left-nominalX,top-nominalY))
      else image:drawSprite(sprite,index+1) end
      local edge, visible, minX, minY, maxX, maxY = 0,0,width,height,-1,-1
      for pixel in image:pixels() do
        local alpha = app.pixelColor.rgbaA(pixel())
        if pixel.x==0 or pixel.x==width-1 or pixel.y==0 or pixel.y==height-1 then edge=math.max(edge,alpha) end
        if alpha>=16 then
          visible=visible+1; minX=math.min(minX,pixel.x); minY=math.min(minY,pixel.y)
          maxX=math.max(maxX,pixel.x); maxY=math.max(maxY,pixel.y)
        end
      end
      assert(visible>0, source.stem.." empty frame "..index)
      assert(edge<16, source.stem.." visible art crosses frame edge "..index..": "..edge)
      local duration=boundary(index+1)-boundary(index)
      assert(duration>=1,"Invalid frame duration")
      if rebuilding then
        if index>0 then sprite:newEmptyFrame() end
        sprite:newCel(sprite.layers[1],index+1,image,Point(0,0))
        sprite.frames[index+1].duration=duration/1000
      else
        assert(round(sprite.frames[index+1].duration*1000)==duration,"Update the shared game clock and export timing together")
      end
      table.insert(item.frames,{index=index,duration=duration,maxEdgeAlpha=edge,
        visibleBounds={x=minX,y=minY,w=maxX-minX+1,h=maxY-minY+1},visiblePixels=visible})
    end
    if rebuilding then
      sprite:newTag(1,timing.peak).name="Preparation"
      sprite:newTag(timing.peak+1,timing.peak+1).name="Impact"
      sprite:newTag(timing.peak+2,grid.count).name="Recovery"
      sprite.data="Stable center anchor; original illustrated motion retained. Terminal frame has 1 ms hold."
      sprite:saveAs(path(editable))
    end
    app.sprite=sprite
    local sheet="apps/client/public/assets/vfx/"..source.stem..".png"
    local metadata="apps/client/public/assets/vfx/"..source.stem..".json"
    app.command.ExportSpriteSheet{ui=false,askOverwrite=false,type=SpriteSheetType.ROWS,columns=grid.columns,
      textureFilename=path(sheet),dataFilename=path(metadata),dataFormat=SpriteSheetDataFormat.JSON_ARRAY,
      filenameFormat="{frame}",borderPadding=0,shapePadding=0,innerPadding=0,
      trim=false,trimSprite=false,extrude=false,ignoreEmpty=false,mergeDuplicates=false,listTags=true,listLayers=true}
    local exported=Image{fromFile=path(sheet)}
    local data=readJson(metadata)
    assert(#data.frames==grid.count,"Exported frame count mismatch")
    for index,frame in ipairs(data.frames) do
      local rectangle=frame.frame
      local actual=Image(exported,Rectangle(rectangle.x,rectangle.y,rectangle.w,rectangle.h))
      local expected=Image(width,height,ColorMode.RGB);expected:drawSprite(sprite,index)
      assert(actual:isEqual(expected),"Exported frame pixel mismatch "..index)
      assert(rectangle.w==width and rectangle.h==height and not frame.trimmed and not frame.rotated,"Export changed framing")
      assert(frame.duration==item.frames[index].duration,"Exported timing mismatch")
    end
    -- Reopen the editable source too: this checks saved cels and timeline, not only in-memory images.
    local reopened=Sprite{fromFile=path(editable)}
    assert(#reopened.frames==grid.count and reopened.width==width and reopened.height==height,"Editable source mismatch")
    for index,frame in ipairs(reopened.frames) do
      assert(round(frame.duration*1000)==item.frames[index].duration,"Saved timeline mismatch")
      local saved=Image(width,height,ColorMode.RGB);saved:drawSprite(reopened,index)
      local expected=Image(width,height,ColorMode.RGB);expected:drawSprite(sprite,index)
      assert(saved:isEqual(expected),"Saved cel mismatch")
    end
    reopened:close();sprite:close()
    item.editable=editable;item.sheet=sheet;item.metadata=metadata;item.reimportVerified=true
    table.insert(report.assets,item)
    print(source.stem..": "..grid.count.." aligned frames, "..timing.duration.." ms; export/reimport verified")
  end
end
assert(#report.assets==3,"Expected three motion samples")
writeJson("docs/assets/aseprite-motion-audit.json",report)
